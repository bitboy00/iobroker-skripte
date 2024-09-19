# iobroker-skripte
Skripte zur Nutzung in iobroker

ACME_Letsencrypt_export.js
Wenn mit dem Adapter ACME ein letsencrypt-Zertifikat erzeugt wurde, steht es in IOBROKER einigen Adaptern zur Verfügung.
viele Adapter und externe Programme (z.B. Grafana) sehen diese Certs aber nicht, weil sie in dem Objekt system/certificates liegen und nicht im Dateisystem.
Das Skript sucht nach collections von Zertifikaten, die durch ACME angelegt wurden und schreibt die Dateien in das Verzeichnis, welches im Script oben festgelegt wird.
Danach kann man die Zertifikate - wie gewohnt - in der Zertifikatverwaltung von iobroker verlinken und in anderen Adaptern nutzen, oder auch in unabhängigen Paketen wie Grafana.
