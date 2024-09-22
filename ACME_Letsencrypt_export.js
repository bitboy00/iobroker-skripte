const os = require('os');
const path = require('path');
const fs = require('fs');  // File system module

// Directory for certificates
const certificatesPath = '/opt/iobroker/certificates/';
// Default path for the restart flag
const flagPath = path.join(convertPathForWindows(certificatesPath), 'new_ssl_cert.txt');

// Function to convert Unix-style paths to Windows paths
function convertPathForWindows(p) {
    if (os.platform() === 'win32' && p.startsWith('/')) {
        let driveLetter = p.charAt(1).toUpperCase(); // Extract the drive letter
        let remainingPath = p.slice(2); // Rest of the path
        return driveLetter + ':' + remainingPath.replace(/\//g, '\\'); // Create Windows-style path
    }
    return p; // Return unchanged for Linux paths
}

// Function to compare the contents of files
async function compareFileContents(filePath, content) {
    try {
        if (!fs.existsSync(filePath)) return false; // File does not exist
        const existingContent = await fs.promises.readFile(filePath, 'utf8');
        return existingContent === content; // Return whether the contents are identical
    } catch (err) {
        log(`Error comparing file contents: ${err.message}`, 'error');
        return false;
    }
}

// Function to set the restart flag
function setRestartFlag() {
    try {
        // Check if the flag already exists
        if (fs.existsSync(flagPath)) {
            log(`Warning: Restart flag already exists: ${flagPath}`, 'warn');
            return; // Do nothing, the flag is already set
        }

        // Set the flag as it doesn't exist
        fs.writeFileSync(flagPath, 'restart', { mode: 0o644 });
        log(`Restart flag has been set: ${flagPath}`, 'info');
    } catch (err) {
        log(`Error setting the restart flag: ${err.message}`, 'error');
    }
}

// Function to save certificate files
async function saveCertificates(collectionName, privateKey, publicCert, chainCert) {
    try {
        // Create the directory if it doesn't exist
        if (!fs.existsSync(certificatesPath)) {
            fs.mkdirSync(certificatesPath, { recursive: true });
        }

        // Check if the script has write permissions for the certificate directory
        await fs.promises.access(certificatesPath, fs.constants.W_OK);

        // Create file paths based on collection name
        const privateKeyPath = path.join(certificatesPath, `${collectionName}_key.pem`);
        const publicCertPath = path.join(certificatesPath, `${collectionName}_cert.pem`);
        const chainCertPath = path.join(certificatesPath, `${collectionName}_chain.pem`);

        // Validate certificate data
        if (!privateKey.startsWith('-----BEGIN')) {
            log(`Invalid private key for collection: ${collectionName}`, 'error');
            return;
        }

        if (!publicCert.startsWith('-----BEGIN')) {
            log(`Invalid certificate for collection: ${collectionName}`, 'error');
            return;
        }

        // Compare new data with existing files
        const keyChanged = !(await compareFileContents(privateKeyPath, privateKey));
        const certChanged = !(await compareFileContents(publicCertPath, publicCert));
        const chainChanged = chainCert
            ? !(await compareFileContents(chainCertPath, chainCert.join('\n')))
            : false;

        // If something has changed, save the files and set the restart flag
        if (keyChanged || certChanged || chainChanged) {
            await fs.promises.writeFile(privateKeyPath, privateKey, { mode: 0o640 });
            log(`Private key saved at: ${privateKeyPath}`, 'info');

            await fs.promises.writeFile(publicCertPath, publicCert, { mode: 0o644 });
            log(`Certificate saved at: ${publicCertPath}`, 'info');

            if (chainCert) {
                const chainData = chainCert.join('\n');
                await fs.promises.writeFile(chainCertPath, chainData, { mode: 0o644 });
                log(`Certificate chain saved at: ${chainCertPath}`, 'info');
            }

            // Set the restart flag if certificates were changed
            setRestartFlag();
        } else {
            log(`No changes detected in the certificates for ${collectionName}.`, 'info');
        }
    } catch (err) {
        log(`Error saving certificates for ${collectionName}: ${err.message}`, 'error');
    }
}

// Function to retrieve and process certificates from all collections
async function processCertificates() {
    try {
        const obj = await getObjectAsync('system.certificates');
        if (!obj || !obj.native || !obj.native.collections) {
            log('Error: Could not retrieve certificate collections.', 'error');
            return;
        }

        const collections = obj.native.collections;

        // Loop through all collections
        for (const collectionName of Object.keys(collections)) {
            const collection = collections[collectionName];

            if (collection.key && collection.cert) {
                // Extract private key and certificate from the collection
                const privateKey = collection.key;
                const publicCert = collection.cert;

                // Extract certificate chain if available
                const chainCert = collection.chain ? collection.chain : null;

                // Save certificates with dynamic collection name
                await saveCertificates(collectionName, privateKey, publicCert, chainCert);
            } else {
                log(`No valid certificates found for collection: ${collectionName}`, 'info');
            }
        }
    } catch (err) {
        log(`Error retrieving system certificates: ${err.message}`, 'error');
    }
}

// Process certificates once at startup
processCertificates();

// Re-run the script every 24 hours (daily at midnight)
schedule("0 0 * * *", function () {
    processCertificates();
});
