import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const generateAndSharePDF = async (title: string, htmlContent: string) => {
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
      return;
    }
    
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: title });
  } catch (error) {
    Alert.alert('Erro', 'Não foi possível gerar ou compartilhar o PDF.');
    console.error(error);
  }
};

export const getExportHtmlTemplate = (
  userName: string,
  month: string,
  revenue: number,
  expenses: number,
  dasStatus: string
) => {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica', sans-serif; color: #333; padding: 40px; }
          h1 { color: #1E293B; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; }
          .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .info { font-size: 14px; color: #64748B; }
          .card { background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { text-align: left; padding: 12px; border-bottom: 1px solid #E2E8F0; }
          th { background-color: #F1F5F9; color: #475569; }
          .total { font-weight: bold; font-size: 18px; color: #0F172A; }
          .footer { margin-top: 50px; font-size: 12px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">MEIFlow</div>
            <div class="info">Relatório Contábil Mensal</div>
          </div>
          <div class="info">
            Período: <b>${month}</b><br/>
            Empreendedor: <b>${userName}</b>
          </div>
        </div>

        <h1>Resumo Financeiro</h1>
        
        <div class="card">
          <table>
            <tr>
              <th>Descrição</th>
              <th>Valor (R$)</th>
            </tr>
            <tr>
              <td>Faturamento Bruto (Receitas)</td>
              <td style="color: #10B981;">R$ ${revenue.toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr>
              <td>Despesas Totais</td>
              <td style="color: #EF4444;">R$ ${expenses.toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr>
              <td class="total">Lucro Líquido</td>
              <td class="total">R$ ${(revenue - expenses).toFixed(2).replace('.', ',')}</td>
            </tr>
          </table>
        </div>

        <h1>Conformidade Fiscal</h1>
        
        <div class="card">
          <table>
            <tr>
              <th>Obrigação</th>
              <th>Status</th>
            </tr>
            <tr>
              <td>Guia DAS (Simples Nacional)</td>
              <td><b>${dasStatus}</b></td>
            </tr>
          </table>
        </div>

        <div class="footer">
          Documento gerado eletronicamente por MEIFlow App.<br/>
          Para uso do escritório contábil.
        </div>
      </body>
    </html>
  `;
};
