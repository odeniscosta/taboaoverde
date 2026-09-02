// ============================================================
// CALCULADORA DE ECONOMIA — Taboão Verde
// Captura lead e envia para n8n webhook
// ============================================================

// Taxas de economia (conservadoras, em compliance com "pode chegar a / até")
const RATES = {
  solar:  { min: 0.70, max: 0.95, label: 'Conexão Solar',  desc: 'Instalação gratuita no telhado, placas suas ao final do contrato' },
  placas: { min: 0.70, max: 0.95, label: 'Conexão Placas', desc: 'Sistema fotovoltaico próprio no telhado desde o dia 1' },
  livre:  { min: 0.20, max: 0.30, label: 'Conexão Livre',  desc: 'Mercado Livre de Energia (média/alta tensão), sem obra' },
};

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

let calcData = { bill: 0, solution: 'solar' };
const track = (name, params = {}) => window.trackTVEvent?.(name, params);

function billRange(value) {
  if (value < 300) return '50-299';
  if (value < 600) return '300-599';
  if (value < 1000) return '600-999';
  return '1000-plus';
}

// ── Elementos ──
const step1    = document.getElementById('calc-step-1');
const step2    = document.getElementById('calc-step-2');
const step3    = document.getElementById('calc-step-3');
const stepOk   = document.getElementById('calc-step-ok');
const billInput = document.getElementById('calc-bill');
const calcBtn1  = document.getElementById('calc-btn-1');
const calcBtn2  = document.getElementById('calc-btn-2');
const backBtn2  = document.getElementById('calc-back-2');
const backBtn3  = document.getElementById('calc-back-3');
const calcForm  = document.getElementById('calcForm');

function showStep(step) {
  [step1, step2, step3, stepOk].forEach(s => s?.classList.remove('is-active'));
  step?.classList.add('is-active');
}

// ── PASSO 1: Calcular ──
calcBtn1?.addEventListener('click', () => {
  const raw = billInput?.value.replace(/\D/g, '');
  const val = parseInt(raw || '0', 10);
  if (val < 50) {
    billInput?.focus();
    return;
  }
  calcData.bill = val;
  track('simulation_started', { bill_range: billRange(val) });
  renderResults(val);
  showStep(step2);
});

billInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calcBtn1?.click();
});

// ── PASSO 2: Mostrar resultados ──
function renderResults(bill) {
  const container = document.getElementById('calc-results');
  if (!container) return;

  const entries = Object.entries(RATES);
  container.innerHTML = entries.map(([key, r]) => {
    const saving = Math.round(bill * r.max);
    const annual = saving * 12;
    return `
      <label class="calc-result-card" data-key="${key}">
        <input type="radio" name="solution" value="${key}" ${key === 'solar' ? 'checked' : ''}>
        <div class="calc-result-dot"></div>
        <div class="calc-result-info">
          <div class="calc-result-name">${r.label}</div>
          <div class="calc-result-saving">Até ${fmt(saving)}<span style="font-size:14px;font-weight:500">/mês</span></div>
          <div class="calc-result-detail">${r.desc} · Até ${fmt(annual)}/ano</div>
        </div>
      </label>
    `;
  }).join('');

  // Selecionar card ao clicar
  container.querySelectorAll('.calc-result-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.calc-result-card').forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      card.querySelector('input[type="radio"]').checked = true;
      calcData.solution = card.dataset.key;
    });
    // Marca o primeiro como selecionado por padrão
    if (card.dataset.key === 'solar') {
      card.classList.add('is-selected');
      calcData.solution = 'solar';
    }
  });
}

// Botão WhatsApp direto — pula o formulário
const calcWaDirect = document.getElementById('calc-wa-direct');
calcWaDirect?.addEventListener('click', () => {
  const selected = document.querySelector('input[name="solution"]:checked');
  if (selected) calcData.solution = selected.value;

  const solutionLabel = RATES[calcData.solution]?.label || calcData.solution;
  const saving = fmt(Math.round(calcData.bill * RATES[calcData.solution].max));
  const texto = [
    `Olá, Taboão Verde! Fiz a simulação no site.`,
    `Minha conta de luz é em média R$ ${calcData.bill}.`,
    `Tenho interesse na ${solutionLabel} com economia de até ${saving}/mês.`,
    `Quero saber mais!`,
  ].join(' ');

  if (CONFIG.webhookUrl) {
    fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Não informado',
        whatsapp: null,
        tipo_cliente: null,
        valor_conta: calcData.bill,
        solucao_interesse: solutionLabel,
        origem: 'calculadora_direto',
        consentimento: true,
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  track('simulation_whatsapp', { solution: calcData.solution, source: 'direct' });
  showStep(stepOk);
});

calcBtn2?.addEventListener('click', () => {
  const selected = document.querySelector('input[name="solution"]:checked');
  if (selected) calcData.solution = selected.value;
  showStep(step3);
});

backBtn2?.addEventListener('click', () => showStep(step1));
backBtn3?.addEventListener('click', () => showStep(step2));

// ── PASSO 3: Capturar lead ──
calcForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome    = document.getElementById('calc-nome')?.value.trim();
  const tel     = document.getElementById('calc-tel')?.value.trim();
  const tipo    = document.getElementById('calc-tipo')?.value;
  const consent = document.getElementById('calc-consent')?.checked;

  if (!nome || !tel || !consent) return;

  const solutionLabel = RATES[calcData.solution]?.label || calcData.solution;

  const payload = {
    nome,
    whatsapp:          tel,
    tipo_cliente:      tipo,
    valor_conta:       calcData.bill,
    solucao_interesse: solutionLabel,
    origem:            'calculadora',
    consentimento:     consent,
    created_at:        new Date().toISOString(),
  };

  // Envia ao n8n (sem bloquear)
  if (CONFIG.webhookUrl) {
    fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // Monta texto para WhatsApp
  const saving = fmt(Math.round(calcData.bill * RATES[calcData.solution].max));
  const texto = [
    `Olá, Taboão Verde! Meu nome é ${nome}.`,
    `Fiz a simulação e minha conta é em média R$ ${calcData.bill}.`,
    `Tenho interesse na ${solutionLabel} com economia de até ${saving}/mês.`,
    `Segmento: ${tipo}. Aguardo contato!`,
  ].join(' ');

  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  track('simulation_lead_submit', { solution: calcData.solution, client_type: tipo || 'not_selected' });
  showStep(stepOk);
});
