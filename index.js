const fs = require('fs');
const cron = require('node-cron');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
var admin = require("firebase-admin");
const express = require('express')
const app = express();
let port = 3030
let serviceAccout = require('./firebase.json')

initializeApp({
  credential: admin.credential.cert(serviceAccout),
});

const db = getFirestore();

async function backupCollectionIncrementally(collectionName, batchSize = 100) {
  const collectionRef = db.collection(collectionName);
  let lastDoc = null;
  let data = [];
  let hasMore = true;

  while (hasMore) {
    let query = collectionRef.orderBy('__name__').limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    saveBackupToFile(data, collectionName);
  }

  return data;
}

function saveBackupToFile(data, collectionName) {
  const filePath = `./backups/backup_${collectionName}.json`;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Backup parcial salvo para a coleção ${collectionName} em ${filePath}`);
}

async function createBackup() {
  try {
    const dataHora = new Date();
    const formatado = d => ('0' + d).slice(-2);
    const dataHoraFormatada = `${formatado(dataHora.getDate())}/${formatado(dataHora.getMonth() + 1)}/${dataHora.getFullYear()} ${formatado(dataHora.getHours())}:${formatado(dataHora.getMinutes())}:${formatado(dataHora.getSeconds())}`;
    console.log(`[${dataHoraFormatada}] Iniciando o backup... `)
    const collections = ['servers', 'users', 'tickets'];

    for (const collection of collections) {
      await backupCollectionIncrementally(collection);
    }

    console.log(`[${dataHoraFormatada}] Backup concluído com sucesso.`);
  } catch (error) {
    console.error('Erro ao criar o backup:', error);
  }
}

//'0 */12 * * *'
cron.schedule('* * * * *', () => {
    createBackup();
});


app.listen(port, () => {
    console.log(`BackUp rodando na porta: ${port}`);
});

