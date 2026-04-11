import * as XLSX from 'xlsx';
import { Parcel, User } from './auth';

export const exportMonthlyReportToExcel = (parcels: Parcel[], users: User[], filename?: string) => {
  // Group by month and station
  const groupedData: Record<string, Record<string, any>> = {};
  
  // Create a map of users for quick lookup
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, User>);

  parcels.forEach(parcel => {
    const date = new Date(parcel.createdAt);
    const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const station = parcel.destinationCity;

    if (!groupedData[monthYear]) {
      groupedData[monthYear] = {};
    }

    if (!groupedData[monthYear][station]) {
      groupedData[monthYear][station] = {
        'Mois': monthYear,
        'Gare/Ville': station,
        'Total Colis': 0,
        'Colis Payés': 0,
        'Colis Livrés': 0,
        'Chiffre d\'Affaires (FCFA)': 0
      };
    }

    groupedData[monthYear][station]['Total Colis'] += 1;
    if (parcel.isPaid) {
      groupedData[monthYear][station]['Colis Payés'] += 1;
      groupedData[monthYear][station]['Chiffre d\'Affaires (FCFA)'] += parcel.price;
    }
    if (parcel.status === 'LIVRE') {
      groupedData[monthYear][station]['Colis Livrés'] += 1;
    }
  });

  // Flatten data for Excel
  const reportData: any[] = [];
  // Sort by month (descending) and then by station (ascending)
  const sortedMonths = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));
  
  sortedMonths.forEach(month => {
    const sortedStations = Object.keys(groupedData[month]).sort();
    sortedStations.forEach(station => {
      reportData.push(groupedData[month][station]);
    });
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportData);

  // Set column widths
  const wscols = [
    {wch: 15}, // Mois
    {wch: 20}, // Gare/Ville
    {wch: 15}, // Total Colis
    {wch: 15}, // Colis Payés
    {wch: 15}, // Colis Livrés
    {wch: 25}, // Chiffre d'Affaires
  ];
  ws['!cols'] = wscols;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Bilan Mensuel");

  // Add a second sheet with all raw data for reference
  const rawData = parcels.map(p => {
    const creator = userMap[p.createdBy];
    const originCity = creator?.city || 'Inconnue';
    
    return {
      'Ville Origine': originCity,
      'Valeur Colis': p.value,
      'Expéditeur': p.senderName,
      'Date/Heure Expédition': new Date(p.createdAt).toLocaleString('fr-FR'),
      'Date/Heure Livraison': p.deliveredAt ? new Date(p.deliveredAt).toLocaleString('fr-FR') : '-',
      'Type Colis': p.packageType,
      'Ville Destination': p.destinationCity,
      'Destinataire': p.recipientName,
      'Code Colis': p.code,
      'Statut': p.status,
      'Payé': p.isPaid ? 'Oui' : 'Non'
    };
  });
  const wsRaw = XLSX.utils.json_to_sheet(rawData);
  XLSX.utils.book_append_sheet(wb, wsRaw, "Détails Colis");

  // Save file
  const finalFilename = filename || `Bilan_Mensuel_DBS_BAN_${new Date().toISOString().split('T')[0]}`;
  XLSX.writeFile(wb, `${finalFilename}.xlsx`);
};

export const exportTenDayReportToExcel = (parcels: Parcel[], users: User[]) => {
  // Group by 10-day period
  const groupedData: Record<string, any> = {};
  
  // Create a map of users for quick lookup
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, User>);

  parcels.forEach(parcel => {
    const date = new Date(parcel.createdAt);
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    let startDay, endDay;
    if (day <= 10) {
      startDay = 1;
      endDay = 10;
    } else if (day <= 20) {
      startDay = 11;
      endDay = 20;
    } else {
      startDay = 21;
      endDay = new Date(year, month + 1, 0).getDate();
    }

    const periodKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`;
    const periodLabel = `Période du ${startDay} au ${endDay} ${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;

    if (!groupedData[periodKey]) {
      groupedData[periodKey] = {
        'Période': periodLabel,
        'Total Colis': 0,
        'Colis Payés': 0,
        'Colis Livrés': 0,
        'Chiffre d\'Affaires (FCFA)': 0,
        'Détails Tarifs': {} // To store breakdown of prices
      };
    }

    groupedData[periodKey]['Total Colis'] += 1;
    if (parcel.isPaid) {
      groupedData[periodKey]['Colis Payés'] += 1;
      groupedData[periodKey]['Chiffre d\'Affaires (FCFA)'] += parcel.price;
      
      // Breakdown by price
      const priceStr = `${parcel.price} FCFA`;
      groupedData[periodKey]['Détails Tarifs'][priceStr] = (groupedData[periodKey]['Détails Tarifs'][priceStr] || 0) + 1;
    }
    if (parcel.status === 'LIVRE') {
      groupedData[periodKey]['Colis Livrés'] += 1;
    }
  });

  // Flatten data for Excel
  const reportData: any[] = [];
  const sortedPeriods = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));
  
  sortedPeriods.forEach(periodKey => {
    const period = groupedData[periodKey];
    // Convert price breakdown to string
    const breakdown = Object.entries(period['Détails Tarifs'])
      .map(([price, count]) => `${price}: ${count}`)
      .join(', ');
    
    reportData.push({
      'Période': period['Période'],
      'Total Colis': period['Total Colis'],
      'Colis Payés': period['Colis Payés'],
      'Colis Livrés': period['Colis Livrés'],
      'Chiffre d\'Affaires (FCFA)': period['Chiffre d\'Affaires (FCFA)'],
      'Détail des Tarifs (Colis Payés)': breakdown
    });
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportData);

  // Set column widths
  const wscols = [
    {wch: 35}, // Période
    {wch: 15}, // Total Colis
    {wch: 15}, // Colis Payés
    {wch: 15}, // Colis Livrés
    {wch: 25}, // Chiffre d'Affaires
    {wch: 50}, // Détail des Tarifs
  ];
  ws['!cols'] = wscols;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Bilan 10 Jours");

  // Add a second sheet with all raw data for reference
  const rawData = parcels.map(p => {
    const creator = userMap[p.createdBy];
    const originCity = creator?.city || 'Inconnue';
    
    return {
      'Ville Origine': originCity,
      'Valeur Colis': p.value,
      'Expéditeur': p.senderName,
      'Date/Heure Expédition': new Date(p.createdAt).toLocaleString('fr-FR'),
      'Date/Heure Livraison': p.deliveredAt ? new Date(p.deliveredAt).toLocaleString('fr-FR') : '-',
      'Type Colis': p.packageType,
      'Ville Destination': p.destinationCity,
      'Destinataire': p.recipientName,
      'Code Colis': p.code,
      'Statut': p.status,
      'Payé': p.isPaid ? 'Oui' : 'Non'
    };
  });
  const wsRaw = XLSX.utils.json_to_sheet(rawData);
  XLSX.utils.book_append_sheet(wb, wsRaw, "Détails Colis");

  // Save file
  XLSX.writeFile(wb, `Bilan_10Jours_DBS_BAN_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportParcelListToExcel = (parcels: Parcel[], users: User[], filename: string = 'Liste_Colis') => {
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, User>);

  const data = parcels.map(p => {
    const creator = userMap[p.createdBy];
    const originCity = creator?.city || 'Inconnue';

    return {
      'Ville Origine': originCity,
      'Valeur Colis': p.value,
      'Expéditeur': p.senderName,
      'Date/Heure Expédition': new Date(p.createdAt).toLocaleString('fr-FR'),
      'Date/Heure Livraison': p.deliveredAt ? new Date(p.deliveredAt).toLocaleString('fr-FR') : '-',
      'Type Colis': p.packageType,
      'Ville Destination': p.destinationCity,
      'Destinataire': p.recipientName,
      'Code Colis': p.code,
      'Statut': p.status,
      'Payé': p.isPaid ? 'Oui' : 'Non',
      'Tél Expéditeur': p.senderPhone,
      'Tél Destinataire': p.recipientPhone,
      'Quantité': p.quantity,
      'Prix (FCFA)': p.price,
      'Date Paiement': p.paidAt ? new Date(p.paidAt).toLocaleString('fr-FR') : '-',
      'Date Arrivée': p.arrivedAt ? new Date(p.arrivedAt).toLocaleString('fr-FR') : '-',
      'Notes': p.notes || ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Colis");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
