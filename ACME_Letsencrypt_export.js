const os = require('os');
const path = require('path');
const fs = require('fs').promises; // Use asynchronous file system methods
const { constants: fsConstants } = require('fs'); // For fs.access

// Configuration
const certificatesPath = '/opt/iobroker/certificates/'; // Default certificates directory
const createFlag = true; // Control whether to create the restart flag

// Function to sanitize collection names to prevent path traversal and ensure valid characters
function sanitizeCollectionName(name) {
    // Replace any character that is not alphanumeric, underscore, or hyphen with an underscore
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Function to validate collection names
function isValidCollectionName(name) {
    // Only allow alphanumerics, underscores, and hyphens
    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    return validNameRegex.test(name);
}

// Function to compare the contents of files
async function compareFileContents(filePath, content) {
    try {
        // Check if the file exists
        await fs.access(filePath, fsConstants.F_OK);
    } catch (err) {
        // File does not exist
        return false;
    }

    try {
        const existingContent = await fs.readFile(filePath, 'utf8');
        return existingContent === content; // Return whether the contents are identical
    } catch (err) {
        log(`Error reading file for comparison: ${filePath}: ${err.message}`, 'error');
        return false;
    }
}

// Function to set the restart flag with the collection name prefixed
async function setRestartFlag(collectionName) {
    if (!createFlag) {
        log(`Flag creation is disabled for collection ${collectionName}`, 'info');
        return;
    }

    const sanitizedCollectionName = sanitizeCollectionName(collectionName);
    const flagFileName = `${sanitizedCollectionName}_new_ssl_cert.txt`;
    const flagPath = path.join(certificatesPath, flagFileName);

    try {
        // Check if the flag already exists
        try {
            await fs.access(flagPath, fsConstants.F_OK);
            log(`Restart flag already exists for collection ${collectionName}: ${flagPath}`, 'warn');
            return; // Do nothing, the flag is already set
        } catch (err) {
            // Flag does not exist, proceed to create it
        }

        // Set the flag as it doesn't exist
        await fs.writeFile(flagPath, 'restart', { mode: 0o644 });
        log(`Restart flag has been set for collection ${collectionName}: ${flagPath}`, 'info');
    } catch (err) {
        log(`Error setting the restart flag for collection ${collectionName}: ${err.message}`, 'error');
    }
}

// Function to save certificate files
async function saveCertificates(collectionName, privateKey, publicCert, chainCert) {
    try {
        // Validate collection name
        if (!isValidCollectionName(collectionName)) {
            log(`Invalid collection name: ${collectionName}. Skipping...`, 'error');
            return;
        }

        const sanitizedCollectionName = sanitizeCollectionName(collectionName);

        // Ensure the certificates directory exists
        try {
            await fs.access(certificatesPath, fsConstants.W_OK);
        } catch (err) {
            // Directory does not exist; create it
            await fs.mkdir(certificatesPath, { recursive: true });
            log(`Created certificate directory: ${certificatesPath}`, 'info');
        }

        // Create file paths based on sanitized collection name
        const privateKeyPath = path.join(certificatesPath, `${sanitizedCollectionName}_key.pem`);
        const publicCertPath = path.join(certificatesPath, `${sanitizedCollectionName}_cert.pem`);
        const chainCertPath = path.join(certificatesPath, `${sanitizedCollectionName}_fullchain.pem`);

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
            if (keyChanged) {
                await fs.writeFile(privateKeyPath, privateKey, { mode: 0o640 });
                log(`Private key saved at: ${privateKeyPath}`, 'info');
            }

            if (certChanged) {
                await fs.writeFile(publicCertPath, publicCert, { mode: 0o644 });
                log(`Certificate saved at: ${publicCertPath}`, 'info');
            }

            if (chainChanged && chainCert) {
                const chainData = chainCert.join('\n');
                await fs.writeFile(chainCertPath, chainData, { mode: 0o644 });
                log(`Certificate chain saved at: ${chainCertPath}`, 'info');
            }

            // Set the restart flag with the collection name
            await setRestartFlag(collectionName);
        } else {
            log(`No changes detected in the certificates for ${collectionName}.`, 'info');
        }
    } catch (err) {
        log(`Error saving certificates for collection ${collectionName}: ${err.message}`, 'error');
    }
}

// Function to retrieve and process certificates from all collections
async function processCertificates() {
    try {
        const obj = await getObjectAsync('system.certificates'); // Ensure getObjectAsync is available
        if (!obj || !obj.native || !obj.native.collections) {
            log('Could not retrieve certificate collections.', 'error');
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

// Process certificates every day at midnight
schedule("0 0 * * *", function () {
    processCertificates();
    log(`Scheduled certificate processing executed.`, 'info');
});
