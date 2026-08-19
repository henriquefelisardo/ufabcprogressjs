from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import pandas as pd
import unicodedata
import re
import csv
import io
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

#uvicorn main:app --reload

app = FastAPI(title="UFABC Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "A API da UFABC está online e operando."}

COLUNAS = [
    "ano_periodo", "categoria", "codigo", "componente_curricular",
    "creditos", "ch", "ch_ext", "turma", "conceito", "situacao", "docentes"
]
COLUNAS_SEM_ESPACO = {"codigo", "turma"}
IDX_SEM_ESPACO = {COLUNAS.index(c) for c in COLUNAS_SEM_ESPACO}

def _normalizar_cabecalho(texto):
    if texto is None: return ""
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)).lower()

def _padronizar_texto_pdf(texto):
    if texto is None: return ""
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)).upper()

def padronizar_nome(texto):
    if not texto: return ""
    texto = unicodedata.normalize("NFKD", " ".join(str(texto).split()))
    return "".join(c for c in texto if not unicodedata.combining(c)).upper().replace('"', '').replace(',', '').strip()

def abreviar_curso(nome):
    if not nome: return ""
    subs = {"BACHARELADO EM CIENCIA E TECNOLOGIA": "BCT", "BACHARELADO EM CIENCIAS E HUMANIDADES": "BCH", "BACHARELADO EM ": "B. ", "ENGENHARIA ": "ENG. ", "LICENCIATURA EM ": "LIC. "}
    for k, v in subs.items(): nome = nome.replace(k, v)
    return nome

def _eh_tabela_alvo(linha_cabecalho):
    texto = _normalizar_cabecalho(" ".join(c for c in linha_cabecalho if c))
    return "componente curricular" in texto and "docente" in texto

def _limpar_celula_pdf(valor, sem_espaco):
    if valor is None: return ""
    texto = str(valor).strip()
    if sem_espaco: texto = texto.replace("\n", "").strip()
    else: texto = " ".join(texto.split())
    return _padronizar_texto_pdf(texto)

def extrair_componentes_pdf(bytes_arquivo):
    linhas_brutas = []
    with pdfplumber.open(io.BytesIO(bytes_arquivo)) as pdf:
        for pagina in pdf.pages:
            tabelas = pagina.find_tables()
            for tabela in tabelas:
                dados = tabela.extract()
                if not dados: continue
                cabecalho = dados[0]
                if not _eh_tabela_alvo(cabecalho): continue

                for linha in dados[1:]:
                    linha = list(linha) + [None] * (len(COLUNAS) - len(linha))
                    linha = linha[: len(COLUNAS)]
                    normalizada = [_limpar_celula_pdf(v, i in IDX_SEM_ESPACO) for i, v in enumerate(linha)]
                    
                    if all(v == "" for v in normalizada): continue
                    
                    if normalizada[0] == "" and linhas_brutas:
                        mesclada = list(linhas_brutas[-1])
                        for i, valor in enumerate(normalizada):
                            if not valor: continue
                            if not mesclada[i]: mesclada[i] = valor
                            elif i in IDX_SEM_ESPACO: mesclada[i] += valor
                            else: mesclada[i] += " " + valor
                        linhas_brutas[-1] = mesclada
                    else:
                        linhas_brutas.append(normalizada)
    return linhas_brutas

def extrair_texto_matricula(texto, dicionario_ch, catalogo_csv_ch):
    disciplinas = []
    if not texto.strip(): return disciplinas
    padrao_sigaa = r'(?:[A-Z]{3,4}\d{3,4}-\d{2}\s*-\s*)?(.*?)\s+(?:[A-Z]{1,3}\d{1,2}.*?)?TPI\s*\(\s*(\d+)\s*-\s*(\d+)'
    
    for linha in texto.split('\n'):
        linha = linha.strip()
        if not linha: continue
        match = re.search(padrao_sigaa, linha, re.IGNORECASE)
        if match:
            ch = (int(match.group(2)) + int(match.group(3))) * 12
            disciplinas.append((padronizar_nome(match.group(1).strip()), ch, 'NOVA_MATR'))
        else:
            nome_limpo = padronizar_nome(linha)
            if not nome_limpo: continue

            # 1. Match Exato O(1): Evita colisões de substrings (I vs II, III, etc)
            if nome_limpo in dicionario_ch:
                disciplinas.append((nome_limpo, dicionario_ch[nome_limpo], 'NOVA_MATR'))
                continue
            if nome_limpo in catalogo_csv_ch:
                disciplinas.append((nome_limpo, catalogo_csv_ch[nome_limpo], 'NOVA_MATR'))
                continue

            # 2. Match Parcial O(n): Fallback caso o SIGAA quebre a linha ou o nome
            encontrado = False
            for mat_pdf, ch_pdf in dicionario_ch.items():
                if nome_limpo in mat_pdf or mat_pdf in nome_limpo:
                    if mat_pdf.endswith(" I") and nome_limpo.endswith(" II"): continue # Blindagem extra
                    disciplinas.append((mat_pdf, ch_pdf, 'NOVA_MATR'))
                    encontrado = True
                    break
            
            if not encontrado:
                for mat_csv, ch_csv in catalogo_csv_ch.items():
                    if nome_limpo in mat_csv or mat_csv in nome_limpo:
                        if mat_csv.endswith(" I") and nome_limpo.endswith(" II"): continue # Blindagem extra
                        disciplinas.append((mat_csv, ch_csv, 'NOVA_MATR'))
                        encontrado = True
                        break
                        
            if not encontrado:
                disciplinas.append((nome_limpo, 0, 'NOVA_MATR'))

    return disciplinas

def carregar_banco_metas(caminho_csv="BASE_CURSOS.csv"):
    if not Path(caminho_csv).exists(): return {}, {}
    with open(caminho_csv, mode="r", encoding="utf-8-sig") as f:
        texto = f.read()
        delim = '\t' if '\t' in texto else (';' if ';' in texto else ',')
        f.seek(0)
        linhas = list(csv.reader(f, delimiter=delim))
    
    if len(linhas) < 5: return {}, {}
    
    cursos = {}
    catalogo_ch = {}
    curso_atual = None
    
    for i in range(len(linhas[1])):
        if i < len(linhas[0]) and padronizar_nome(linhas[0][i]):
            curso_atual = abreviar_curso(padronizar_nome(linhas[0][i]))
            if curso_atual not in cursos:
                cursos[curso_atual] = {
                    "metas": {"OBR": 0, "OL": 0, "LIV": 0, "TOTAL": 0, "COMP": 0, "EXT": 0},
                    "grade": {"OBR": set(), "OL": set()}
                }
                
        cat_meta = padronizar_nome(linhas[1][i])
        if not cat_meta or not curso_atual: continue
        
        val = int(padronizar_nome(linhas[2][i])) if i < len(linhas[2]) and padronizar_nome(linhas[2][i]).isdigit() else 0
        
        if "OBRIGAT" in cat_meta: cursos[curso_atual]["metas"]["OBR"] = val
        elif "LIMITAD" in cat_meta: cursos[curso_atual]["metas"]["OL"] = val
        elif "LIVRE" in cat_meta: cursos[curso_atual]["metas"]["LIV"] = val
        elif "TOTAL" in cat_meta: cursos[curso_atual]["metas"]["TOTAL"] = val
        elif "COMPLEMENTARES" in cat_meta: cursos[curso_atual]["metas"]["COMP"] = val
        elif "EXTENSIONISTAS" in cat_meta: cursos[curso_atual]["metas"]["EXT"] = val
    
    curso_atual = cat_atual = None
    for col in range(len(linhas[3])):
        if col < len(linhas[0]) and padronizar_nome(linhas[0][col]):
            curso_atual = abreviar_curso(padronizar_nome(linhas[0][col]))
        if padronizar_nome(linhas[3][col]): 
            cat_atual = padronizar_nome(linhas[3][col])
            
        header = padronizar_nome(linhas[4][col]) if col < len(linhas[4]) else ""
        
        if header == "DISCIPLINA" and curso_atual and cat_atual:
            chave_cat = "OBR" if "OBRIGAT" in cat_atual else ("OL" if "LIMITAD" in cat_atual else None)
            if chave_cat:
                for row_idx in range(5, len(linhas)):
                    if col < len(linhas[row_idx]):
                        mat = padronizar_nome(linhas[row_idx][col])
                        if mat:
                            cursos[curso_atual]["grade"][chave_cat].add(mat)
                            if col + 1 < len(linhas[row_idx]):
                                ch_raw = str(linhas[row_idx][col + 1])
                                ch_num = re.sub(r'\D', '', ch_raw)
                                if ch_num:
                                    catalogo_ch[mat] = int(ch_num)
    return cursos, catalogo_ch

cursos_bd, catalogo_csv_ch = carregar_banco_metas()

def _calcular_cenario(hist_filtrado, dados_curso):
    real_obr = real_ol = real_liv = 0
    # Adicionado 's' (status) no desempacotamento da tupla
    for mat, ch, s in hist_filtrado:
        if mat in dados_curso["grade"]["OBR"]: real_obr += ch
        elif mat in dados_curso["grade"]["OL"]: real_ol += ch
        else: real_liv += ch
            
    m_obr, m_ol, m_liv, m_tot = (dados_curso["metas"][k] for k in ["OBR", "OL", "LIV", "TOTAL"])
    pend_obr, pend_ol = max(0, m_obr - real_obr), max(0, m_ol - real_ol)
    excesso_ol = max(0, real_ol - m_ol)
    
    saldo_livres = real_liv + excesso_ol
    liv_aprov = min(saldo_livres, m_liv)
    liv_desc = max(0, saldo_livres - m_liv)
    pend_liv = max(0, m_liv - liv_aprov)
    
    ch_aprov = real_obr + (real_ol - excesso_ol) + liv_aprov
    pend_geral = max(0, m_tot - ch_aprov)
    pct = (ch_aprov / m_tot) * 100 if m_tot > 0 else 0
    
    return {
        "real_obr": real_obr, "pend_obr": pend_obr, "m_obr": m_obr,
        "real_ol": real_ol, "pend_ol": pend_ol, "m_ol": m_ol, "excesso_ol": excesso_ol,
        "saldo_livres": saldo_livres, "liv_aprov": liv_aprov, "pend_liv": pend_liv, "m_liv": m_liv, "liv_desc": liv_desc,
        "ch_aproveitada": ch_aprov, "pend_geral": pend_geral, "m_tot": m_tot, "pct": pct
    }

@app.post("/api/simular")
async def simular_cenarios(request: Request):
    form = await request.form()
    
    student_indices = set(key.split("_")[1] for key in form.keys() if key.startswith("nome_"))
    
    students_extracted = []
    dicionario_ch_global = {}
    
    idx_comp, idx_ch, idx_sit = COLUNAS.index("componente_curricular"), COLUNAS.index("ch"), COLUNAS.index("situacao")
    for idx in student_indices:
        nome = form.get(f"nome_{idx}", f"Competidor {int(idx)+1}")
        matricula = form.get(f"matricula_{idx}", "")
        file = form.get(f"file_{idx}")
        
        historico_limpo = []
        if file and getattr(file, "filename", None):
            bytes_arquivo = await file.read()
            linhas_pdf = extrair_componentes_pdf(bytes_arquivo)
            for linha in linhas_pdf:
                n, c_str, s = padronizar_nome(linha[idx_comp]), padronizar_nome(linha[idx_ch]), padronizar_nome(linha[idx_sit])
                if n and c_str.isdigit():
                    ch_val = int(c_str)
                    historico_limpo.append((n, ch_val, s))
                    if n not in dicionario_ch_global: 
                        dicionario_ch_global[n] = ch_val
                        
        students_extracted.append({"nome": nome, "matricula": matricula, "historico_limpo": historico_limpo})
    
    students_data = []
    for ext in students_extracted:
        # Mantendo o status na construção das listas
        hist_atual = [(m, c, s) for m, c, s in ext["historico_limpo"] if s == 'APR']
        hist_proj = [(m, c, s) for m, c, s in ext["historico_limpo"] if s in ['APR', 'MATR']]
        novas_disciplinas = extrair_texto_matricula(ext["matricula"], dicionario_ch_global, catalogo_csv_ch)
        hist_novo = hist_proj + [(m, c, s) for m, c, s in novas_disciplinas]
        
        cursos_resultados = {}
        for curso, dados in cursos_bd.items():
            
            def agrupar_listas(hist_usado):
                obr, ol, liv, n_rec = [], [], [], []
                vistos = set()
                # Monta dicionários com nome, CH e status para o React
                for mat, ch, s in hist_usado:
                    if mat in vistos: continue
                    vistos.add(mat)
                    item = {"nome": mat, "ch": ch, "status": s}
                    if ch == 0: n_rec.append(item)
                    elif mat in dados["grade"]["OBR"]: obr.append(item)
                    elif mat in dados["grade"]["OL"]: ol.append(item)
                    else: liv.append(item)
                return {
                    "obr": obr, "ol": ol, "liv": liv, "n_rec": n_rec, 
                    "faltam_obr": sorted(list(dados["grade"]["OBR"] - vistos))
                }

            cursos_resultados[curso] = {
                "atual": {"metricas": _calcular_cenario(hist_atual, dados), "listas": agrupar_listas(hist_atual)},
                "projecao": {"metricas": _calcular_cenario(hist_proj, dados), "listas": agrupar_listas(hist_proj)},
                "novo": {"metricas": _calcular_cenario(hist_novo, dados), "listas": agrupar_listas(hist_novo)}
            }
        students_data.append({"nome": ext["nome"], "cursos": cursos_resultados})
        
    return {"status": "success", "students": students_data, "cursos_disponiveis": list(cursos_bd.keys())}


# Monta a pasta 'dist' do React para ser servida pelo FastAPI
dist_path = os.path.join(os.path.dirname(__file__), "dist")

if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        # Redireciona qualquer rota não-API para o index.html do React
        file_path = os.path.join(dist_path, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))