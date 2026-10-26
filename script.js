// Importações SDK Firebase Modular v13
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    push, 
    remove, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

// Credenciais do Realtime Database
const firebaseConfig = {
    apiKey: "AIzaSyBG5-4x7H5UMafYPNHiSs6eLNB7zZMeRLA",
    authDomain: "reservas-mundo-senai.firebaseapp.com",
    databaseURL: "https://reservas-mundo-senai-default-rtdb.firebaseio.com",
    projectId: "reservas-mundo-senai",
    storageBucket: "reservas-mundo-senai.firebasestorage.app",
    messagingSenderId: "935907874298",
    appId: "1:935907874298:web:15a0f1aaa3a24635640043"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const SENHA_ADMIN_LOCAL = "senai2026";

// Estado local da aplicação
let listaEquipamentos = [];
let listaReservas = [];

// Define data atual padrão no formulário
function definirDataPadrao() {
    const hoje = new Date().toISOString().split('T')[0];
    const dataInput = document.getElementById('dataReserva');
    if (dataInput && !dataInput.value) {
        dataInput.value = hoje;
    }
}

// Escuta do Banco de Dados Realtime
function escutarRealtimeDatabase() {
    // Escutar Equipamentos
    const refEquipamentos = ref(db, "equipamentos");
    onValue(refEquipamentos, (snapshot) => {
        listaEquipamentos = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(id => {
                listaEquipamentos.push({ id: id, ...data[id] });
            });
        }
        carregarItensDisponiveis();
        if (document.getElementById('containerInventarioAdmin')) {
            renderizarInventarioAdmin();
        }
    });

    // Escutar Reservas
    const refReservas = ref(db, "reservas_equipamentos");
    onValue(refReservas, (snapshot) => {
        listaReservas = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(id => {
                listaReservas.push({ id: id, ...data[id] });
            });
        }
        carregarItensDisponiveis();
        renderizarReservasPublicas();
        if (document.getElementById('secaoConteudoAdmin') && !document.getElementById('secaoConteudoAdmin').classList.contains('hidden')) {
            renderizarReservasAdmin();
        }
    });
}

// Filtra e preenche a lista de seleção apenas com itens livres para a Data/Período
function carregarItensDisponiveis() {
    const select = document.getElementById('selectItem');
    const badge = document.getElementById('badgeDisponiveis');
    if (!select) return;

    const dataSel = document.getElementById('dataReserva')?.value;
    const periodoSel = document.querySelector('input[name="periodoReserva"]:checked')?.value;
    const tipoSel = document.querySelector('input[name="tipoEquipamento"]:checked')?.value;

    if (!dataSel) {
        select.innerHTML = '<option value="">Selecione uma data primeiro...</option>';
        if (badge) badge.textContent = "Data pendente";
        return;
    }

    // Identifica itens indisponíveis (já reservados)
    const idsReservados = listaReservas
        .filter(res => res.data === dataSel && res.periodo === periodoSel)
        .map(res => res.equipamentoId);

    // Filtra disponíveis pelo tipo
    const disponiveis = listaEquipamentos.filter(item => {
        return item.tipo === tipoSel && !idsReservados.includes(item.id);
    });

    select.innerHTML = '';

    if (disponiveis.length === 0) {
        select.innerHTML = `<option value="">Nenhum ${tipoSel} disponível para este turno/data</option>`;
        if (badge) {
            badge.textContent = "0 disponíveis";
            badge.className = "text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full";
        }
        return;
    }

    select.innerHTML = `<option value="">-- Escolha um ${tipoSel} --</option>`;
    disponiveis.forEach(item => {
        select.innerHTML += `<option value="${item.id}">${item.nome} ${item.patrimonio ? '(' + item.patrimonio + ')' : ''}</option>`;
    });

    if (badge) {
        badge.textContent = `${disponiveis.length} disponível(is)`;
        badge.className = "text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full";
    }
}

// Salva Reserva no Realtime Database
async function realizarReserva(e) {
    e.preventDefault();

    const btn = document.getElementById('btnReservar');
    const status = document.getElementById('statusReserva');

    const professor = document.getElementById('nomeProfessor').value.trim();
    const data = document.getElementById('dataReserva').value;
    const periodo = document.querySelector('input[name="periodoReserva"]:checked').value;
    const tipo = document.querySelector('input[name="tipoEquipamento"]:checked').value;
    const equipamentoId = document.getElementById('selectItem').value;

    if (!professor || !data || !equipamentoId) {
        alert('Preencha todos os campos!');
        return;
    }

    const itemObj = listaEquipamentos.find(item => item.id === equipamentoId);
    if (!itemObj) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...`;

    try {
        const refReservas = ref(db, "reservas_equipamentos");
        await push(refReservas, {
            professor: professor,
            data: data,
            periodo: periodo,
            tipo: tipo,
            equipamentoId: equipamentoId,
            equipamentoNome: itemObj.nome,
            patrimonio: itemObj.patrimonio || '',
            criadoEm: serverTimestamp()
        });

        status.className = "mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold";
        status.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500 text-lg"></i> Reserva confirmada com sucesso para ${itemObj.nome}!`;
        status.classList.remove('hidden');

        document.getElementById('selectItem').value = '';

    } catch (err) {
        status.className = "mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-semibold";
        status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-500 text-lg"></i> Erro ao reservar: ${err.message}`;
        status.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Confirmar Reserva`;
    }
}

// Exibe a lista pública das reservas
function renderizarReservasPublicas() {
    const container = document.getElementById('containerReservas');
    if (!container) return;

    const filtroProf = document.getElementById('buscaProfessor')?.value.toLowerCase().trim();
    const filtroData = document.getElementById('filtroDataGeral')?.value;

    container.innerHTML = '';

    let filtrados = listaReservas.filter(res => {
        const atendeProf = !filtroProf || res.professor.toLowerCase().includes(filtroProf);
        const atendeData = !filtroData || res.data === filtroData;
        return atendeProf && atendeData;
    });

    filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

    const totalBadge = document.getElementById('badgeTotalReservas');
    if (totalBadge) totalBadge.textContent = filtrados.length;

    if (filtrados.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Nenhuma reserva localizada.</p>`;
        return;
    }

    filtrados.forEach(res => {
        const icone = res.tipo === 'Notebook' ? 'fa-laptop text-blue-600' : 'fa-tv text-purple-600';
        const dataFormatada = res.data.split('-').reverse().join('/');

        container.innerHTML += `
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm">
                        <i class="fa-solid ${icone}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-extrabold text-slate-800">${res.equipamentoNome}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">${res.periodo}</span>
                        </div>
                        <p class="text-xs text-slate-600 mt-0.5"><i class="fa-solid fa-user text-slate-400"></i> Prof. ${res.professor}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        <i class="fa-regular fa-calendar text-senai-orange"></i> ${dataFormatada}
                    </span>
                </div>
            </div>`;
    });
}

// Autenticação do Administrador
function autenticarAdmin() {
    const senha = document.getElementById('senhaAdminInput').value;
    if (senha === SENHA_ADMIN_LOCAL) {
        document.getElementById('secaoLoginAdmin').classList.add('hidden');
        document.getElementById('secaoConteudoAdmin').classList.remove('hidden');

        renderizarInventarioAdmin();
        renderizarReservasAdmin();
    } else {
        alert('Senha incorreta!');
    }
}

// Adiciona novo equipamento no banco
async function cadastrarNovoItem(e) {
    e.preventDefault();

    const nome = document.getElementById('novoItemNome').value.trim();
    const tipo = document.getElementById('novoItemTipo').value;
    const patrimonio = document.getElementById('novoItemPatrimonio').value.trim();

    try {
        const refEquipamentos = ref(db, "equipamentos");
        await push(refEquipamentos, {
            nome: nome,
            tipo: tipo,
            patrimonio: patrimonio
        });

        document.getElementById('novoItemNome').value = '';
        document.getElementById('novoItemPatrimonio').value = '';
        alert('Equipamento cadastrado com sucesso!');
    } catch (err) {
        alert('Erro ao cadastrar: ' + err.message);
    }
}

// Renderiza lista de inventário no Painel Admin
function renderizarInventarioAdmin() {
    const container = document.getElementById('containerInventarioAdmin');
    if (!container) return;

    container.innerHTML = '';
    const badge = document.getElementById('badgeTotalInventario');
    if (badge) badge.textContent = `${listaEquipamentos.length} itens cadastrados`;

    if (listaEquipamentos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 col-span-3">Nenhum equipamento cadastrado até o momento.</p>`;
        return;
    }

    listaEquipamentos.forEach(item => {
        const icone = item.tipo === 'Notebook' ? 'fa-laptop text-blue-600' : 'fa-tv text-purple-600';

        const div = document.createElement('div');
        div.className = "p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between";
        div.innerHTML = `
            <div class="flex items-center gap-2.5">
                <i class="fa-solid ${icone} text-base"></i>
                <div>
                    <h4 class="font-bold text-xs text-slate-800">${item.nome}</h4>
                    <p class="text-[10px] text-slate-500">${item.patrimonio || 'Sem patrimônio'}</p>
                </div>
            </div>
            <button class="btn-excluir text-rose-500 hover:text-rose-700 text-xs p-1.5" title="Excluir Equipamento">
                <i class="fa-solid fa-trash-can"></i>
            </button>`;

        div.querySelector('.btn-excluir').addEventListener('click', () => excluirEquipamento(item.id, item.nome));
        container.appendChild(div);
    });
}

// Exclui equipamento do Realtime Database
async function excluirEquipamento(id, nome) {
    if (confirm(`Tem certeza que deseja excluir "${nome}"?`)) {
        try {
            await remove(ref(db, `equipamentos/${id}`));
        } catch (err) {
            alert('Erro ao remover: ' + err.message);
        }
    }
}

// Renderiza controle geral de reservas no Admin
function renderizarReservasAdmin() {
    const container = document.getElementById('containerReservasAdmin');
    if (!container) return;

    const termo = document.getElementById('buscaReservaAdmin')?.value.toLowerCase().trim();
    container.innerHTML = '';

    let filtrados = listaReservas.filter(res => {
        return !termo || res.professor.toLowerCase().includes(termo) || res.equipamentoNome.toLowerCase().includes(termo);
    });

    filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (filtrados.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Nenhum agendamento encontrado.</p>`;
        return;
    }

    filtrados.forEach(res => {
        const dataFormatada = res.data.split('-').reverse().join('/');

        const div = document.createElement('div');
        div.className = "p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2";
        div.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-slate-800">${res.equipamentoNome}</span>
                    <span class="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">${res.periodo}</span>
                    <span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">${dataFormatada}</span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">Professor Responsável: <strong>${res.professor}</strong></p>
            </div>
            <button class="btn-cancelar bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-3 py-1.5 rounded-lg font-bold border border-rose-200 transition">
                <i class="fa-solid fa-xmark"></i> Cancelar Reserva
            </button>`;

        div.querySelector('.btn-cancelar').addEventListener('click', () => cancelarReservaAdmin(res.id));
        container.appendChild(div);
    });
}

// Cancela a reserva no Realtime Database
async function cancelarReservaAdmin(idReserva) {
    if (confirm("Deseja cancelar esta reserva?")) {
        try {
            await remove(ref(db, `reservas_equipamentos/${idReserva}`));
        } catch (err) {
            alert('Erro ao cancelar: ' + err.message);
        }
    }
}

// FUNÇÃO DE LIMPEZA GERAL / RESET DO BANCO DE DADOS
async function resetarBancoDeDados() {
    const confirmacao1 = confirm("ATENÇÃO: Deseja apagar TODAS as reservas e TODOS os equipamentos cadastrados?");
    if (!confirmacao1) return;

    const confirmacao2 = confirm("Tem certeza absoluta? Esta ação deixará o banco de dados completamente vazio.");
    if (!confirmacao2) return;

    try {
        await remove(ref(db, "reservas_equipamentos"));
        await remove(ref(db, "equipamentos"));
        alert("Banco de dados zerado com sucesso!");
    } catch (err) {
        alert("Erro ao resetar o banco de dados: " + err.message);
    }
}

// Exportar CSV
function exportarReservasCSV() {
    let csv = "\uFEFFProfessor;Equipamento;Tipo;Periodo;Data\n";

    listaReservas.forEach(res => {
        const dataFormatada = res.data.split('-').reverse().join('/');
        csv += `"${res.professor}";"${res.equipamentoNome}";"${res.tipo}";"${res.periodo}";"${dataFormatada}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reservas_Equipamentos_SENAI.csv`;
    link.click();
}

// Atribuição de Event Listeners e Inicialização DOM
document.addEventListener('DOMContentLoaded', () => {
    definirDataPadrao();
    escutarRealtimeDatabase();

    // Eventos do formulário e entradas
    document.getElementById('formReserva')?.addEventListener('submit', realizarReserva);
    document.getElementById('dataReserva')?.addEventListener('change', carregarItensDisponiveis);
    document.getElementById('buscaProfessor')?.addEventListener('input', renderizarReservasPublicas);
    document.getElementById('filtroDataGeral')?.addEventListener('change', renderizarReservasPublicas);

    document.querySelectorAll('input[name="periodoReserva"]').forEach(r => r.addEventListener('change', carregarItensDisponiveis));
    document.querySelectorAll('input[name="tipoEquipamento"]').forEach(r => r.addEventListener('change', carregarItensDisponiveis));

    // Eventos do Admin
    document.getElementById('btnEntrarAdmin')?.addEventListener('click', autenticarAdmin);
    document.getElementById('formNovoEquipamento')?.addEventListener('submit', cadastrarNovoItem);
    document.getElementById('buscaReservaAdmin')?.addEventListener('input', renderizarReservasAdmin);
    document.getElementById('btnExportarCSV')?.addEventListener('click', exportarReservasCSV);
    document.getElementById('btnResetBanco')?.addEventListener('click', resetarBancoDeDados);
});