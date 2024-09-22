# iobroker-scripts
Scripts for use in iobroker

ACME_Letsencrypt_export.js: 
If a letsencrypt certificate has been generated with the ACME adapter, it is available to some adapters in IOBROKER.
However, many adapters and external programs (e.g. Grafana) do not see these certs because they are stored in the object system/certificates in so-called 
collections and not in the file system.
The script searches for collections of certificates created by ACME and writes the files to the directory specified in the script above.
The file name is [collectionName]_key.pem, [collectionName]_cert.pem and [collectionName]_chain.pem 
A flag is generated when an existing cert is updated. This can be used to recognize externally whether certain services that depend on it should be restarted. 
You can then link the certificates - as usual - in the certificate management of iobroker and use them in other adapters or in independent packages such as Grafana.
