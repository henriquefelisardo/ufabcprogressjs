import React, { useState, useMemo } from 'react';

// Componente: Lista Sanfona (Expansível) Modernizada e Alfabética
const ExpanderList = ({ title, icon, items, fallbackText, studentName, toggledList = [], onToggle, hideCheckbox = false, startsChecked = true, allowDisableApr = false }) => {
  
  const sortedItems = [...items].sort((a, b) => {
    const nameA = typeof a === 'object' ? a.nome : a;
    const nameB = typeof b === 'object' ? b.nome : b;
    return nameA.localeCompare(nameB);
  });

  return (
    <details className="bg-white/[0.02] rounded-xl border border-white/[0.05] mb-3 group overflow-hidden transition-all duration-300 hover:bg-white/[0.04]">
      <summary className="p-4 cursor-pointer select-none font-medium flex items-center transition-colors outline-none text-gray-200">
        <span className="mr-3 text-xl bg-white/[0.05] p-2 rounded-lg">{icon}</span>
        {title} <span className="ml-2 text-sm text-gray-500">({items.length})</span>
        <span className="ml-auto opacity-50 group-open:rotate-180 transition-transform duration-300">▼</span>
      </summary>
      <div className="p-4 pt-0 text-sm text-gray-400 max-h-60 overflow-y-auto">
        {sortedItems.length > 0 ? (
          <ul className="space-y-2">
            {sortedItems.map((item, i) => {
              const isObj = typeof item === 'object';
              const name = isObj ? item.nome : item;
              const ch = isObj ? item.ch : null;
              const status = isObj ? item.status : null;
              
              const canDisable = !hideCheckbox && (status !== 'APR' || allowDisableApr || status === 'FALTA');
              const isChecked = startsChecked ? !toggledList.includes(name) : toggledList.includes(name);

              return (
                <li key={i} className={`flex items-center gap-3 transition-all ${!isChecked ? 'opacity-40' : 'opacity-100'}`}>
                  {canDisable ? (
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={() => onToggle && onToggle(studentName, name)} 
                      className="w-4 h-4 cursor-pointer accent-indigo-500 shrink-0"
                    />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 ml-1.5"></span>
                  )}
                  <span className={!isChecked ? 'line-through text-gray-500' : 'text-gray-300'}>
                    {name} {ch > 0 && <span className="text-xs text-gray-500 ml-1">({ch}h)</span>}
                  </span>
                  {status === 'MATR' && <span className="ml-auto shrink-0 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded uppercase font-bold">Cursando</span>}
                  {status === 'NOVA_MATR' && <span className="ml-auto shrink-0 text-[10px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded uppercase font-bold">Projetada</span>}
                  {status === 'FALTA' && <span className="ml-auto shrink-0 text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded uppercase font-bold">Pendente</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500 italic">{fallbackText || "Nenhuma disciplina."}</p>
        )}
      </div>
    </details>
  );
};

export default function App() {
  const [studentsInput, setStudentsInput] = useState([{ id: 0, nome: 'Aluno 1', file: null, matricula: '', ra: '', curso_base: 'BCT' }]);
  const [isArena, setIsArena] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);

  const [cenarioAtivo, setCenarioAtivo] = useState('novo');
  const [cursoSelecionado, setCursoSelecionado] = useState('');
  const [arenaTab, setArenaTab] = useState('');
  
  const [disabledSubjects, setDisabledSubjects] = useState({});
  const [enabledMissingSubjects, setEnabledMissingSubjects] = useState({});

  const updateStudent = (index, field, value) => {
    const updated = [...studentsInput];
    updated[index][field] = value;
    setStudentsInput(updated);
  };

  const addCompetitor = () => {
    setStudentsInput([...studentsInput, { id: Date.now(), nome: `Competidor ${studentsInput.length + 1}`, file: null, matricula: '', ra: '', curso_base: 'BCT' }]);
  };

  const removeCompetitor = (idToRemove) => {
    if (studentsInput.length > 1) {
      setStudentsInput(studentsInput.filter(s => s.id !== idToRemove));
    }
  };

  const toggleSubject = (studentName, subjectName) => {
    setDisabledSubjects(prev => {
      const current = prev[studentName] || [];
      if (current.includes(subjectName)) return { ...prev, [studentName]: current.filter(name => name !== subjectName) };
      return { ...prev, [studentName]: [...current, subjectName] };
    });
  };

  const toggleMissingSubject = (studentName, subjectName) => {
    setEnabledMissingSubjects(prev => {
      const current = prev[studentName] || [];
      if (current.includes(subjectName)) return { ...prev, [studentName]: current.filter(name => name !== subjectName) };
      return { ...prev, [studentName]: [...current, subjectName] };
    });
  };

  const getRecalculatedMetrics = (studentName, curso, cenario) => {
    const student = apiData.students.find(s => s.nome === studentName);
    const data = student.cursos[curso][cenario];
    const origM = data.metricas;
    const l = data.listas;
    
    const disabled = disabledSubjects[studentName] || [];
    const enabledMissing = enabledMissingSubjects[studentName] || [];
    if (disabled.length === 0 && enabledMissing.length === 0) return origM;

    const sumCH = (list) => list.filter(item => !disabled.includes(item.nome)).reduce((acc, curr) => acc + curr.ch, 0);
    const extraObrCH = l.faltam_obr.filter(item => enabledMissing.includes(item.nome)).reduce((acc, curr) => acc + curr.ch, 0);

    const real_obr = sumCH(l.obr) + extraObrCH;
    const real_ol = sumCH(l.ol);
    const real_liv = sumCH(l.liv);
    const { m_obr, m_ol, m_liv, m_tot } = origM;

    const pend_obr = Math.max(0, m_obr - real_obr);
    const pend_ol = Math.max(0, m_ol - real_ol);
    const excesso_ol = Math.max(0, real_ol - m_ol);

    const saldo_livres = real_liv + excesso_ol;
    const liv_aprov = Math.min(saldo_livres, m_liv);
    const liv_desc = Math.max(0, saldo_livres - m_liv);
    const pend_liv = Math.max(0, m_liv - liv_aprov);

    const ch_aproveitada = real_obr + (real_ol - excesso_ol) + liv_aprov;
    const pend_geral = Math.max(0, m_tot - ch_aproveitada);
    const pct = m_tot > 0 ? (ch_aproveitada / m_tot) * 100 : 0;

    return { real_obr, pend_obr, m_obr, real_ol, pend_ol, m_ol, excesso_ol, saldo_livres, liv_aprov, pend_liv, m_liv, liv_desc, ch_aproveitada, pend_geral, m_tot, pct };
  };

  const handleSimulate = async () => {
    setLoading(true);
    setDisabledSubjects({});
    setEnabledMissingSubjects({});
    const formData = new FormData();
    
    studentsInput.forEach((s, idx) => {
      formData.append(`nome_${idx}`, s.nome);
      formData.append(`ra_${idx}`, s.ra || '');
      formData.append(`curso_base_${idx}`, s.curso_base); 
      formData.append(`matricula_${idx}`, s.matricula);
      if (s.file) formData.append(`file_${idx}`, s.file);
    });

    try {
      const response = await fetch('https://ufabcprogressjs.onrender.com/api/simular', { method: 'POST', body: formData });
      //const response = await fetch('http://localhost:8000/api/simular', { method: 'POST', body: formData });
      //const response = await fetch('/api/simular', { method: 'POST', body: formData });

      if (!response.ok) {
        const errorText = await response.text();
        alert(`Erro no servidor (Status ${response.status}):\n${errorText}`);
        setLoading(false); return;
      }

      const result = await response.json();
      
      if (result.cursos_disponiveis && result.cursos_disponiveis.length === 0) {
          alert("O backend rodou, mas a lista de cursos está vazia!");
          setLoading(false); return;
      }

      if (result.students && result.students.length > 0) {
        setApiData(result);
        setCursoSelecionado(result.cursos_disponiveis[0]);
        setArenaTab(result.students[0].nome);
        const hasAnyPdf = studentsInput.some(s => s.file !== null);
        setCenarioAtivo(hasAnyPdf ? 'atual' : 'novo');
      }
    } catch (err) {
      alert("Falha de rede ao tentar conectar com a API.");
    }
    setLoading(false);
  };

  const rankingGlobal = useMemo(() => {
    if (!apiData) return [];
    return apiData.cursos_disponiveis.map(curso => {
      const row = { curso, maxPct: 0, chAproveitada: '' };
      apiData.students.forEach(s => {
        const m = getRecalculatedMetrics(s.nome, curso, cenarioAtivo);
        row[s.nome] = m.pct;
        if (m.pct >= row.maxPct) {
          row.maxPct = m.pct;
          row.chAproveitada = `${m.ch_aproveitada}h / ${m.m_tot}h`;
        }
      });
      return row;
    }).sort((a, b) => b.maxPct - a.maxPct);
  }, [apiData, cenarioAtivo, disabledSubjects, enabledMissingSubjects]);

  const renderPanel = (student) => {
    const data = student.cursos[cursoSelecionado][cenarioAtivo];
    const { listas: l } = data;
    
    const m = getRecalculatedMetrics(student.nome, cursoSelecionado, cenarioAtivo);
    const disabledList = disabledSubjects[student.nome] || [];
    const enabledMissingList = enabledMissingSubjects[student.nome] || [];
    
    const missingOL = Math.ceil(m.pend_ol / 48);
    const missingLIV = Math.ceil(m.pend_liv / 48);

    return (
      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h4 className="text-gray-400 text-sm font-medium tracking-wider mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div> Obrigatórias (OBR)
            </h4>
            <p className="text-4xl font-bold text-white tracking-tight">{m.real_obr}<span className="text-lg text-gray-500 font-normal">h</span></p>
            <p className="text-sm text-emerald-400 mt-2 font-medium">Faltam {m.pend_obr}h</p>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h4 className="text-gray-400 text-sm font-medium tracking-wider mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div> Opção Limitada (OL)
            </h4>
            <p className="text-4xl font-bold text-white tracking-tight">{m.real_ol}<span className="text-lg text-gray-500 font-normal">h</span></p>
            <p className="text-sm text-blue-400 mt-2 font-medium">{m.excesso_ol === 0 ? `Faltam ${m.pend_ol}h` : `Sobram ${m.excesso_ol}h (Repassadas)`}</p>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h4 className="text-gray-400 text-sm font-medium tracking-wider mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div> Livres (LIV)
            </h4>
            <p className="text-4xl font-bold text-white tracking-tight">{m.liv_aprov}<span className="text-lg text-gray-500 font-normal">h</span></p>
            <p className="text-sm text-amber-400 mt-2 font-medium">Faltam {m.pend_liv}h</p>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl mb-8">
          <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col">
              <span className="text-gray-400 text-sm tracking-wider uppercase font-semibold">Carga Aproveitada</span>
              <span className="text-2xl font-bold text-white">{m.ch_aproveitada}h <span className="text-gray-500 text-lg font-normal">/ {m.m_tot}h</span></span>
            </div>
            <span className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              {m.pct.toFixed(2)}%
            </span>
          </div>
          <div className="w-full bg-black/50 h-4 rounded-full overflow-hidden border border-white/5 backdrop-blur-md relative p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative transition-all duration-1000 ease-out" 
              style={{ width: `${Math.min(m.pct, 100)}%` }}
            >
               <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] animate-pulse"></div>
            </div>
          </div>
          {m.liv_desc > 0 && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm animate-fade-in-up">
              <span className="mr-2">⚠️</span> <b>Atenção:</b> Acumulou {m.saldo_livres}h em Livres (Teto: {m.m_liv}h). <b className="text-red-400">{m.liv_desc}h descartadas.</b>
            </div>
          )}
        </div>

        <h3 className="text-2xl font-semibold mb-6 text-white/90 tracking-tight">Detalhamento de Disciplinas</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <div className="space-y-2">
            <ExpanderList title="OBR Registradas" icon="🟢" items={l.obr} studentName={student.nome} toggledList={disabledList} onToggle={toggleSubject} />
            <ExpanderList title="OL Registradas" icon="🔵" items={l.ol} studentName={student.nome} toggledList={disabledList} onToggle={toggleSubject} />
            <ExpanderList title="LIV Registradas" icon="🟡" items={l.liv} studentName={student.nome} toggledList={disabledList} onToggle={toggleSubject} allowDisableApr={true} />
            {l.n_rec.length > 0 && (
              <ExpanderList 
                title="Não Reconhecidas" 
                icon="⚠️" 
                items={l.n_rec} 
                fallbackText="Todas mapeadas com sucesso." 
                studentName={student.nome} 
                toggledList={disabledList} 
                onToggle={toggleSubject} 
                hideCheckbox={true} 
              />
            )}
          </div>
          <div className="space-y-2 mt-4 lg:mt-0">
            <ExpanderList title="OBR Faltantes" icon="🔴" items={l.faltam_obr} fallbackText="Todas as OBR concluídas! 🎉" studentName={student.nome} toggledList={enabledMissingList} onToggle={toggleMissingSubject} startsChecked={false} />
            
            {missingOL > 0 && (
              <details className="bg-white/[0.02] rounded-xl border border-white/[0.05] mb-3 group transition-colors hover:bg-white/[0.04]">
                <summary className="p-4 cursor-pointer select-none font-medium flex items-center text-gray-200">
                  <span className="mr-3 text-xl bg-white/[0.05] p-2 rounded-lg">⚙️</span> 
                  OL Faltantes <span className="ml-2 text-indigo-400 font-bold">(~{missingOL})</span>
                  <span className="ml-auto opacity-50 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 pt-0 text-sm text-gray-500">Aproximação baseada na divisão da carga horária pendente por 48h.</div>
              </details>
            )}

            {missingLIV > 0 && (
              <details className="bg-white/[0.02] rounded-xl border border-white/[0.05] mb-3 group transition-colors hover:bg-white/[0.04]">
                <summary className="p-4 cursor-pointer select-none font-medium flex items-center text-gray-200">
                  <span className="mr-3 text-xl bg-white/[0.05] p-2 rounded-lg">💡</span> 
                  LIV Faltantes <span className="ml-2 text-pink-400 font-bold">(~{missingLIV})</span>
                  <span className="ml-auto opacity-50 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 pt-0 text-sm text-gray-500">Aproximação baseada na divisão da carga horária pendente por 48h.</div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans pb-20">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-700 rounded-full mix-blend-screen filter blur-[128px] opacity-40 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-700 rounded-full mix-blend-screen filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-700 rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pt-12">
        <header className="mb-12 text-center md:text-left animate-fade-in-up">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Dashboard Curricular <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">UFABC</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-light max-w-2xl">
            Faça o upload do histórico e/ou simule disciplinas desejadas com dados oficiais.
          </p>
        </header>

        <div className="glass-panel p-8 rounded-3xl mb-12 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Configuração de Alunos</h2>
            <button 
              onClick={() => { setIsArena(true); addCompetitor(); }} 
              className="text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-md"
            >
              ⚔️ Ativar Modo Arena
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentsInput.map((s, idx) => (
              <div key={s.id} className="relative bg-black/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm transition-transform hover:-translate-y-1 duration-300">
                
                {studentsInput.length > 1 && (
                  <button 
                    onClick={() => removeCompetitor(s.id)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors bg-white/5 hover:bg-red-500/20 p-2 rounded-lg z-10"
                    title="Remover competidor"
                  >
                    🗑️
                  </button>
                )}

                {isArena && (
                  <input 
                    className="w-full bg-transparent border-b border-gray-600 focus:border-indigo-500 p-2 text-xl font-bold mb-5 outline-none transition-colors text-indigo-100 placeholder-gray-600 pr-10" 
                    value={s.nome} 
                    onChange={e => updateStudent(idx, 'nome', e.target.value)} 
                    placeholder="Nome do Competidor"
                  />
                )}
                
                <label className="block text-sm font-medium text-gray-400 mb-2">🏫 Grade de Ingresso</label>
                <div className="flex gap-4 mb-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input 
                      type="radio" name={`base_${s.id}`} value="BCT" 
                      checked={s.curso_base === 'BCT'} 
                      onChange={e => updateStudent(idx, 'curso_base', e.target.value)} 
                      className="accent-indigo-500 w-4 h-4 cursor-pointer" 
                    /> BCT
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input 
                      type="radio" name={`base_${s.id}`} value="BCH" 
                      checked={s.curso_base === 'BCH'} 
                      onChange={e => updateStudent(idx, 'curso_base', e.target.value)} 
                      className="accent-indigo-500 w-4 h-4 cursor-pointer" 
                    /> BCH
                  </label>
                </div>

                <label className="block text-sm font-medium text-gray-400 mb-2">🎓 RA (Busca Automática) (opcional)</label>
                <input 
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all mb-4 text-white placeholder-gray-600"
                  placeholder="Ex: 11202230067"
                  value={s.ra || ''}
                  onChange={e => updateStudent(idx, 'ra', e.target.value)}
                />

                <label className="block text-sm font-medium text-gray-400 mb-2">📄 Ou/e Histórico em PDF</label>
                <input 
                  type="file" accept=".pdf" 
                  onChange={e => updateStudent(idx, 'file', e.target.files[0])} 
                  className="w-full text-sm text-gray-500 mb-6 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-white/10 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-white/20 transition-all"
                />
                
                <label className="block text-sm font-medium text-gray-400 mb-2">📝 Ou/e Planejamento Futuro</label>
                <textarea 
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all h-28 resize-none placeholder-gray-600"
                  placeholder="Nomes soltos ou log de matricula..."
                  value={s.matricula}
                  onChange={e => updateStudent(idx, 'matricula', e.target.value)}
                />
              </div>
            ))}
          </div>

          <button 
            onClick={handleSimulate} disabled={loading}
            className="mt-8 w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300 transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex justify-center items-center gap-2"
          >
            {loading ? (
              <><span className="animate-spin text-2xl">⚙️</span> Processando Motor...</>
            ) : "Simular Matrículas 🚀"}
          </button>
        </div>

        {apiData && (
          <div className="space-y-12">
            <div className="glass-panel p-8 rounded-3xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
                <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
                  <span className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">🏆</span> Ranking Global
                </h2>
                
                <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md w-full xl:w-auto overflow-x-auto">
                  {['atual', 'projecao', 'novo'].map(cen => (
                    <label key={cen} className={`flex-1 xl:flex-none cursor-pointer px-6 py-2.5 rounded-lg text-sm font-medium transition-all text-center whitespace-nowrap ${cenarioAtivo === cen ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                      <input type="radio" className="hidden" checked={cenarioAtivo === cen} onChange={() => setCenarioAtivo(cen)} />
                      {cen === 'atual' ? 'Situação Atual' : cen === 'projecao' ? 'Matriculadas' : 'Projeção Completa'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-gray-400 text-sm tracking-wider uppercase">
                      <th className="p-4 font-medium">Curso</th>
                      {!isArena && <th className="p-4 font-medium w-32">Horas</th>}
                      {apiData.students.map(s => <th key={s.nome} className="p-4 font-medium w-64">{s.nome}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rankingGlobal.map(r => (
                      <tr key={r.curso} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-sm font-medium text-gray-200">{r.curso}</td>
                        {!isArena && <td className="p-4 text-sm text-gray-100">{r.chAproveitada}</td>}
                        {apiData.students.map(s => (
                          <td key={s.nome} className="p-4 min-w-[140px]">
                            <div className="flex items-center gap-3">
                              <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden hidden md:block border border-white/5">
                                <div className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${r[s.nome]}%` }}></div>
                              </div>
                              <span className="text-sm font-mono text-gray-300 w-12 text-right">{r[s.nome].toFixed(1)}%</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-3xl animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/10 pb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
                  <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">📊</span> Inspeção por Curso
                </h2>
                
                <select 
                  value={cursoSelecionado} 
                  onChange={e => setCursoSelecionado(e.target.value)}
                  className="w-full lg:w-96 bg-black/40 text-gray-200 p-3 rounded-xl outline-none border border-white/10 focus:border-indigo-500 transition-colors font-medium appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                >
                  {apiData.cursos_disponiveis.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                </select>
              </div>

              {isArena && (
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                  {apiData.students.map(s => (
                    <button 
                      key={s.nome} onClick={() => setArenaTab(s.nome)}
                      className={`px-6 py-2.5 rounded-full font-medium whitespace-nowrap transition-all duration-300 ${arenaTab === s.nome ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                      {s.nome}
                    </button>
                  ))}
                </div>
              )}

              {apiData.students.filter(s => !isArena || s.nome === arenaTab).map(student => (
                <div key={student.nome}>{renderPanel(student)}</div>
              ))}
            </div>
          </div>
        )}
        <footer className="mt-24 text-center animate-fade-in-up">
          <p className="text-gray-500 text-xl font-medium">
            Feito por <a href="https://github.com/henriquefelisardo" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-pink-400 hover:underline transition-colors duration-300">@henryfelisardo</a>
          </p>
        </footer>
      </div>
    </div>
  );
}