const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const app = express();

app.use(express.json());

// Definição da senha do painel para evitar acessos externos indesejados
const SENHA_PAINEL = "PortoSeguro2026"; 

// Mapeamento dos Preços Cadastrados na sua Stripe (Substitua pelos seus IDs reais)
const MAPA_DE_PRECOS = {
    "49.97": "price_1M_EXEMPLO_49",
    "54.97": "price_1M_EXEMPLO_54",
    "59.97": "price_1M_EXEMPLO_59",
    "64.97": "price_1M_EXEMPLO_64",
    "69.97": "price_1M_EXEMPLO_69"
};

// 1. ROTA DO PAINEL DO VENDEDOR (HTML VISUAL)
app.get('/painel', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Painel Comercial</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="bg-light py-5">
        <div class="container" style="max-width: 500px;">
            <div class="card p-4 shadow border-0">
                <h4 class="mb-4 text-center fw-bold text-dark">Gerador de Links - Agendor Style</h4>
                <form id="formProposta">
                    <div class="mb-3"><label class="form-label fw-bold">Senha de Acesso</label><input type="password" id="senha" class="form-control" required></div>
                    <div class="mb-3"><label class="form-label fw-bold">E-mail do Cliente</label><input type="email" id="email" class="form-control" required></div>
                    <div class="mb-3"><label class="form-label fw-bold">Quantidade de Veículos</label><input type="number" id="quantidade" class="form-control" min="1" value="1" required></div>
                    <div class="mb-3"><label class="form-label fw-bold">Mensalidade por Veículo</label>
                        <select id="valor" class="form-select">
                            <option value="49.97">R$ 49,97</option><option value="54.97">R$ 54,97</option><option value="59.97" selected>R$ 59,97</option><option value="64.97">R$ 64,97</option><option value="69.97">R$ 69,97</option>
                        </select>
                    </div>
                    <div class="mb-3"><label class="form-label fw-bold">Taxa de Instalação (Total)</label><input type="number" id="taxa" class="form-control" min="0" max="200" value="0"></div>
                    <button type="submit" id="btnGerar" class="btn btn-primary w-100 fw-bold py-2">Gerar Link de Cobrança</button>
                </form>
                <div id="resultado" class="mt-4 p-3 bg-white border rounded d-none">
                    <p class="fw-bold text-success mb-2">✓ Link gerado com sucesso!</p>
                    <input type="text" id="linkFinal" class="form-control mb-2" readonly>
                    <button onclick="navigator.clipboard.writeText(document.getElementById('linkFinal').value); alert('Copiado!');" class="btn btn-outline-primary btn-sm w-100 fw-bold">Copiar Link</button>
                </div>
            </div>
        </div>
        <script>
            document.getElementById('formProposta').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnGerar');
                btn.disabled = true; btn.innerText = 'Processando...';
                const dados = {
                    senha: document.getElementById('senha').value,
                    email_cliente: document.getElementById('email').value,
                    quantidade_veiculos: document.getElementById('quantidade').value,
                    valor_mensal: document.getElementById('valor').value,
                    taxa_instalacao: document.getElementById('taxa').value
                };
                try {
                    const response = await fetch('/criar-proposta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                    const resData = await response.json();
                    if(resData.link_pagamento) {
                        document.getElementById('resultado').classList.remove('d-none');
                        document.getElementById('linkFinal').value = resData.link_pagamento;
                    } else { alert('Erro: ' + resData.erro); }
                } catch (err) { alert('Erro de conexão.'); }
                finally { btn.disabled = false; btn.innerText = 'Gerar Link de Cobrança'; }
            });
        </script>
    </body>
    </html>
    `);
});

// 2. O MOTOR DE INTEGRAÇÃO COM A STRIPE
app.post('/criar-proposta', async (req, res) => {
    try {
        const { senha, email_cliente, quantidade_veiculos, valor_mensal, taxa_instalacao } = req.body;

        // Validação de Segurança 1: Senha do painel
        if (senha !== SENHA_PAINEL) return res.status(401).json({ erro: "Senha do painel incorreta." });

        // Validação de Segurança 2: Valores permitidos
        const priceIdStripe = MAPA_DE_PRECOS[valor_mensal];
        if (!priceIdStripe) return res.status(400).json({ erro: "Valor mensal não permitido." });
        if (taxa_instalacao < 0 || taxa_instalacao > 200) return res.status(400).json({ erro: "Taxa de instalação fora dos limites." });

        // Montagem dos itens do carrinho
        const line_items = [{
            price: priceIdStripe,
            quantity: parseInt(quantidade_veiculos)
        }];

        // Inclusão da taxa de instalação se for maior que zero
        if (parseFloat(taxa_instalacao) > 0) {
            line_items.push({
                price_data: {
                    currency: 'brl',
                    product_data: { name: 'Taxa de Instalação (Cobrança Única)' },
                    unit_amount: Math.round(parseFloat(taxa_instalacao) * 100),
                },
                quantity: 1,
            });
        }

        // Geração da sessão oficial na Stripe
        const session = await stripe.checkout.sessions.create({
            customer_email: email_cliente,
            payment_method_types: ['card', 'pix'],
            line_items,
            mode: 'subscription',
            success_url: 'https://suaempresa.com.br/sucesso', 
            cancel_url: 'https://suaempresa.com.br/cancelado',
        });

        res.json({ link_pagamento: session.url });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
