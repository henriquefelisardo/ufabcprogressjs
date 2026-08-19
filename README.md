# 🎓 Dashboard Curricular UFABC

A UFABC tem uma estrutura de grade única e incrivelmente flexível, mas vamos ser sinceros: calcular na mão quantas horas faltam de OBR, OL e LIV para o seu curso (ou para um curso secundário que você quer tentar) dá trabalho. 

Esse projeto nasceu pra resolver isso. Você joga o seu histórico em PDF, cola as matérias que pretende pegar no próximo quadrimestre, e o sistema projeta exatamente como vai ficar a sua barra de conclusão.

## 🚀 O que ele faz?

* **Leitura Automática (PDF):** Extrai as disciplinas cursadas e aprovadas direto do histórico oficial.
* **Simulação de Matrículas:** Dá pra colar o texto bruto do comprovante do SIGAA (ou digitar os nomes soltos) para simular como a sua grade vai ficar no futuro.
* **Matemática Fiel:** Separa sua carga horária em Obrigatórias, Opções Limitadas e Livres, calculando repasses de horas e avisando se você estourou o teto de créditos livres.
* **⚔️ Modo Arena:** Quer competir com os amigos? Dá pra subir o PDF de vários alunos ao mesmo tempo e gerar um ranking ao vivo pra ver quem está mais perto do diploma.
* **Visão Global:** Cruza seus dados com o `BASE_CURSOS.csv` (matriz oficial), permitindo que você veja seu progresso em literalmente qualquer curso da faculdade, mesmo os que não está matriculado.

## 🛠️ Stack Tecnológica

O app usa uma arquitetura moderna e desacoplada:

* **Frontend:** React + Vite + Tailwind CSS (interface baseada em Glassmorphism, aurora gradients e UI reativa).
* **Backend:** Python + FastAPI (usando `pdfplumber` para raspar os PDFs e processar o motor de cálculo das planilhas em milissegundos).

## 💻 Como rodar localmente

Você vai precisar do Node.js e do Python instalados na sua máquina. O projeto exige que o backend e o frontend rodem simultaneamente em terminais separados.

### 1. Rodando o Backend (API)
Abra o primeiro terminal, acesse a pasta `backend/` e crie um ambiente virtual:

bash
cd backend
python -m venv venv

# Ativando no Windows:
venv\Scripts\activate
# Ativando no Linux/Mac:
source venv/bin/activate

# Instalação das dependências
pip install -r requirements.txt

# Subindo o servidor FastAPI
uvicorn main:app --reload

A API ficará ativa em http://localhost:8000

Rodando o Frontend (Interface)

Abra um novo terminal, acesse a pasta frontend/:

cd frontend

# Instalação dos pacotes
npm install

# Subindo o React
npm run dev

O painel vai abrir no seu navegador, normalmente em http://localhost:5173.

🤝 Contribuindo

Se o leitor de PDF engasgar com alguma matéria de código bizarro ou você quiser melhorar a interface, sinta-se à vontade para abrir uma Issue ou mandar um Pull Request.

Feito por @henryfelisardo
