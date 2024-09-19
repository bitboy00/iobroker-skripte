const fs = require('fs');
const path = '/opt/iobroker/certificates/';  // Übliches Verzeichnis für Zertifikate

// Funktion zum Speichern der Zertifikatsdateien
function speichereZertifikate(collectionName, privateKey, publicCert, chainCert) {
    // Erstellen des Verzeichnisses, falls es nicht existiert
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }

    // Dateien mit dem Collection-Namen speichern
    const privateKeyPath = `${path}${collectionName}_key.pem`;
    const publicCertPath = `${path}${collectionName}_cert.pem`;
    const chainCertPath = `${path}${collectionName}_chain.pem`;

    // Speichern des privaten Schlüssels
    fs.writeFileSync(privateKeyPath, privateKey);
    console.log(`Privater Schlüssel gespeichert unter: ${privateKeyPath}`);

    // Speichern des Zertifikats
    fs.writeFileSync(publicCertPath, publicCert);
    console.log(`Zertifikat gespeichert unter: ${publicCertPath}`);

    // Falls eine Zertifikatskette vorhanden ist, diese speichern
    if (chainCert) {
        fs.writeFileSync(chainCertPath, chainCert);
        console.log(`Zertifikatskette gespeichert unter: ${chainCertPath}`);
    } else {
        console.log('Keine Zertifikatskette für die Collection: ' + collectionName + ' gefunden.');
    }
}

// Funktion zum Abrufen und Speichern der Zertifikate aus allen Collections
function verarbeiteZertifikate() {
    getObject('system.certificates', function (err, obj) {
        if (err || !obj || !obj.native || !obj.native.collections) {
            console.log('Fehler: Zertifikatssammlungen konnten nicht abgerufen werden.');
            return;
        }

        const collections = obj.native.collections;

        // Alle Collections durchlaufen
        Object.keys(collections).forEach(function (collectionName) {
            const collection = collections[collectionName];

            if (collection.key && collection.cert) {
                // Privater Schlüssel und Zertifikat aus der Collection extrahieren
                const privateKey = collection.key;
                const publicCert = collection.cert;

                // Zertifikatskette extrahieren, falls vorhanden
                const chainCert = collection.chain ? collection.chain.join('\n') : null;

                // Zertifikate mit dem dynamischen Collection-Namen speichern
                speichereZertifikate(collectionName, privateKey, publicCert, chainCert);
            } else {
                console.log(`Keine gültigen Zertifikate für die Collection: ${collectionName} gefunden.`);
            }
        });
    });
}

// Beim Start einmalig die Zertifikate verarbeiten
verarbeiteZertifikate();

// Alle 24 Stunden (86400000 ms) das Skript erneut ausführen
schedule("0 0 * * *", function () {
    verarbeiteZertifikate();
});
