// ACME-Letsencrypt-Zertifikate aus iobroker extrahieren und als Dateien speichern.

// Zielverzeichnis für Zertifikate
const certificatesPath = '/opt/iobroker/certificates/';  

const fs = require('fs');
const path = require('path');

// Funktion zum Speichern der Zertifikatsdateien
async function speichereZertifikate(collectionName, privateKey, publicCert, chainCert) {
    try {
        // Erstellen des Verzeichnisses, falls es nicht existiert
        if (!fs.existsSync(certificatesPath)) {
            fs.mkdirSync(certificatesPath, { recursive: true });
        }

        // Überprüfen, ob das Skript Schreibberechtigungen für das Zertifikatsverzeichnis hat
        await fs.promises.access(certificatesPath, fs.constants.W_OK);

        // Dateien mit dem Collection-Namen erstellen
        const privateKeyPath = path.join(certificatesPath, `${collectionName}_key.pem`);
        const publicCertPath = path.join(certificatesPath, `${collectionName}_cert.pem`);
        const chainCertPath = path.join(certificatesPath, `${collectionName}_chain.pem`);

        // Validierung der Zertifikatsdaten
        if (!privateKey.startsWith('-----BEGIN')) {
            log(`Ungültiger privater Schlüssel für die Collection: ${collectionName}`, 'error');
            return;
        }

        if (!publicCert.startsWith('-----BEGIN')) {
            log(`Ungültiges Zertifikat für die Collection: ${collectionName}`, 'error');
            return;
        }

        // Speichern des privaten Schlüssels mit restriktiven Berechtigungen
        await fs.promises.writeFile(privateKeyPath, privateKey, { mode: 0o640 });
        log(`Privater Schlüssel gespeichert unter: ${privateKeyPath}`, 'info');

        // Speichern des Zertifikats
        await fs.promises.writeFile(publicCertPath, publicCert, { mode: 0o644 });
        log(`Zertifikat gespeichert unter: ${publicCertPath}`, 'info');

        // Falls eine Zertifikatskette vorhanden ist, diese speichern
        if (chainCert) {
            // Sicherstellen, dass die Zertifikatskette korrekt formatiert ist
            const chainData = chainCert.join('\n');
            await fs.promises.writeFile(chainCertPath, chainData, { mode: 0o644 });
            log(`Zertifikatskette gespeichert unter: ${chainCertPath}`, 'info');
        } else {
            log(`Keine Zertifikatskette für die Collection: ${collectionName} gefunden.`, 'info');
        }
    } catch (err) {
        log(`Fehler beim Speichern der Zertifikate für ${collectionName}: ${err.message}`, 'error');
    }
}

// Funktion zum Abrufen und Speichern der Zertifikate aus allen Collections
async function verarbeiteZertifikate() {
    try {
        const obj = await getObjectAsync('system.certificates');
        if (!obj || !obj.native || !obj.native.collections) {
            log('Fehler: Zertifikatssammlungen konnten nicht abgerufen werden.', 'error');
            return;
        }

        const collections = obj.native.collections;

        // Alle Collections durchlaufen
        for (const collectionName of Object.keys(collections)) {
            const collection = collections[collectionName];

            if (collection.key && collection.cert) {
                // Privater Schlüssel und Zertifikat aus der Collection extrahieren
                const privateKey = collection.key;
                const publicCert = collection.cert;

                // Zertifikatskette extrahieren, falls vorhanden
                const chainCert = collection.chain ? collection.chain : null;

                // Zertifikate mit dem dynamischen Collection-Namen speichern
                await speichereZertifikate(collectionName, privateKey, publicCert, chainCert);
            } else {
                log(`Keine gültigen Zertifikate für die Collection: ${collectionName} gefunden.`, 'info');
            }
        }
    } catch (err) {
        log(`Fehler beim Abrufen von system.certificates: ${err.message}`, 'error');
    }
}

// Beim Start einmalig die Zertifikate verarbeiten
verarbeiteZertifikate();

// Alle 24 Stunden (täglich um Mitternacht) das Skript erneut ausführen
schedule("0 0 * * *", function () {
    verarbeiteZertifikate();
});
