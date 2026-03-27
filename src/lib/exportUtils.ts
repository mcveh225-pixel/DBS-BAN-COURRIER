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

export const exportWeeklyReportToExcel = (parcels: Parcel[], users: User[]) => {
  // Group by week (starting Monday)
  const groupedData: Record<string, any> = {};
  
  // Create a map of users for quick lookup
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<string, User>);

  parcels.forEach(parcel => {
    const date = new Date(parcel.createdAt);
    // Get Monday of that week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const weekKey = monday.toISOString().split('T')[0];
    const weekLabel = `Semaine du ${monday.toLocaleDateString('fr-FR')}`;

    if (!groupedData[weekKey]) {
      groupedData[weekKey] = {
        'Semaine': weekLabel,
        'Total Colis': 0,
        'Colis Payés': 0,
        'Colis Livrés': 0,
        'Chiffre d\'Affaires (FCFA)': 0,
        'Détails Tarifs': {} // To store breakdown of prices
      };
    }

    groupedData[weekKey]['Total Colis'] += 1;
    if (parcel.isPaid) {
      groupedData[weekKey]['Colis Payés'] += 1;
      groupedData[weekKey]['Chiffre d\'Affaires (FCFA)'] += parcel.price;
      
      // Breakdown by price
      const priceStr = `${parcel.price} FCFA`;
      groupedData[weekKey]['Détails Tarifs'][priceStr] = (groupedData[weekKey]['Détails Tarifs'][priceStr] || 0) + 1;
    }
    if (parcel.status === 'LIVRE') {
      groupedData[weekKey]['Colis Livrés'] += 1;
    }
  });

  // Flatten data for Excel
  const reportData: any[] = [];
  const sortedWeeks = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));
  
  sortedWeeks.forEach(weekKey => {
    const week = groupedData[weekKey];
    // Convert price breakdown to string
    const breakdown = Object.entries(week['Détails Tarifs'])
      .map(([price, count]) => `${price}: ${count}`)
      .join(', ');
    
    reportData.push({
      'Semaine': week['Semaine'],
      'Total Colis': week['Total Colis'],
      'Colis Payés': week['Colis Payés'],
      'Colis Livrés': week['Colis Livrés'],
      'Chiffre d\'Affaires (FCFA)': week['Chiffre d\'Affaires (FCFA)'],
      'Détail des Tarifs (Colis Payés)': breakdown
    });
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(reportData);

  // Set column widths
  const wscols = [
    {wch: 25}, // Semaine
    {wch: 15}, // Total Colis
    {wch: 15}, // Colis Payés
    {wch: 15}, // Colis Livrés
    {wch: 25}, // Chiffre d'Affaires
    {wch: 50}, // Détail des Tarifs
  ];
  ws['!cols'] = wscols;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Bilan Hebdomadaire");

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
  XLSX.writeFile(wb, `Bilan_Hebdo_DBS_BAN_${new Date().toISOString().split('T')[0]}.xlsx`);
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
