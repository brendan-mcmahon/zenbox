const IMAP = require('imap');
const simpleParser = require('mailparser').simpleParser;
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function getSecret(secretName) {
  try {
      const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      if (data.SecretString) {
          return JSON.parse(data.SecretString);
      }
      return null;
  } catch (error) {
      console.error(`Error retrieving secret: ${secretName}`, error);
      throw error;
  }
}

exports.handler = async (event) => {
    return new Promise((resolve, reject) => {
        const imap = new IMAP({
            user: getSecret("zenbox-email"),
            password: getSecret("zenbox-password"),
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 3000
        });

        imap.once('ready', function() {
            imap.openBox('INBOX', true, function(err, box) {
                if (err) reject(err);

                // Fetch latest 10 emails
                const fetchEmails = imap.seq.fetch('1:10', {
                    bodies: ['HEADER', 'TEXT'],
                    struct: true
                });

                fetchEmails.on('message', function(msg) {
                    msg.on('body', function(stream, info) {
                        simpleParser(stream, (err, mail) => {
                            if (err) reject(err);
                            console.log(mail.subject);
                            console.log(mail.text);
                        });
                    });
                });

                fetchEmails.once('end', function() {
                    imap.end();
                });
            });
        });

        imap.once('end', function() {
            resolve("Emails fetched successfully!");
        });

        imap.connect();
    });
};
