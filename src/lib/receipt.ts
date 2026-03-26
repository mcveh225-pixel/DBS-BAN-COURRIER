import { Parcel } from './auth';

export const printReceipt = (parcel: Parcel) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Reçu DBS-BAN - ${parcel.code}</title>
        <style>
          @page {
            size: 100mm 100mm;
            margin: 0;
          }
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 10mm;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            box-sizing: border-box;
          }
          .receipt {
            width: 80mm;
            height: 80mm;
            border: 1px solid #000;
            padding: 5mm;
            display: flex;
            flex-direction: column;
            text-align: center;
            box-sizing: border-box;
            position: relative;
          }
          .header-main {
            font-size: 24pt;
            font-weight: bold;
            margin: 0;
            line-height: 1;
          }
          .header-sub {
            font-size: 10pt;
            margin-bottom: 5mm;
          }
          .section-title {
            font-weight: bold;
            text-decoration: underline;
            text-transform: uppercase;
            margin-top: 3mm;
            margin-bottom: 1mm;
            font-size: 11pt;
          }
          .info-line {
            font-size: 9pt;
            margin: 0.5mm 0;
          }
          .price {
            font-weight: bold;
            font-size: 12pt;
            margin-top: 2mm;
          }
          .code {
            font-family: 'Courier New', Courier, monospace;
            font-weight: bold;
            font-size: 10pt;
            margin-top: 2mm;
            border-top: 1px dashed #000;
            padding-top: 2mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header-main">DBS-BAN</div>
          <div class="header-sub">Diomandé Ban Service</div>
          
          <div class="section-title">EXPEDITEUR</div>
          <div class="info-line">${parcel.senderName}</div>
          <div class="info-line">${parcel.senderPhone}</div>
          <div class="info-line">Contenu: ${parcel.quantity} x ${parcel.packageType}</div>
          <div class="info-line">Valeur: ${parcel.value || 'Non spécifiée'}</div>
          <div class="info-line">Destination: ${parcel.destinationCity}</div>
          <div class="price">TARIF: ${parcel.price.toLocaleString()} FCFA</div>
          
          <div class="section-title">DESTINATAIRE</div>
          <div class="info-line">${parcel.recipientName}</div>
          <div class="info-line">${parcel.recipientPhone}</div>
          
          <div class="code">${parcel.code}</div>
        </div>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
