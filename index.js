const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const SSH = require('simple-ssh');

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  authStrategy: new LocalAuth()
});

const devices = [
  {
    name: 'MikroTik 1',
    device: {
      host: 'xxx.xxx.xxx.xx',
      port: 22,
      user: 'admin',
      pass: 'XXXXXX'
    },
    allowedNumbers: ['6282xxxxxxxx']
  },
  {
    name: 'MikroTik 2',
    device: {
      host: 'xxx.xxx.xx.xx',
      port: 22,
      user: 'admin',
      pass: 'xxxxx'
    },
    allowedNumbers: ['6285nnnnnnnnn']
  }
];

const allowedNumbers = ['6282xxxxxxxx', '6285nnnnnnn'];

// Find the device that corresponds to the sender number
function findDevice(senderNumber) {
  for (const dev of devices) {
    if (dev.allowedNumbers.includes(senderNumber)) {
      return dev;
    }
  }
  return null;
}

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async msg => {
  const text = msg.body.toLowerCase() || '';
  const senderNumber = msg.from.replace('@c.us', '');

   // Check if the sender number is allowed
   if (!allowedNumbers.includes(senderNumber)) {
    msg.reply('Maaf, Anda tidak diizinkan menggunakan bot ini.');
    return;
  }

  if (text === '!ping') {
    msg.reply('pong');
  }
  else if (text === '!menu') {
    const menu = 'Silahkan pilih menu:\n1. #ping/google.com untuk ping\n2. #int Tampilkan Interface\n3. #cpu Tampilkan System Resource\n4. #ppp menampilkan PPP Active\n';
    msg.reply(menu);
  }
  else if (text.includes("#ping/")) {
    const parts = text.split("/");
    const target = parts[1];
    devices.forEach(function(device) {
      const ssh = new SSH(device.device);
      ssh.exec(`ping ${target} count=10`, {
        out: function (stdout) {
          const reply = `${device.name} ping results for ${target}:\n\n${stdout}`;
          device.allowedNumbers.forEach(function(number) {
            if (msg.from.includes(number)) {
              client.sendMessage(msg.from, reply);
            }
          });
          ssh.end();
        },
        err: function (stderr) {
          const reply = `${device.name} error while pinging ${target}:\n\n${stderr}`;
          device.allowedNumbers.forEach(function(number) {
            if (msg.from.includes(number)) {
              client.sendMessage(msg.from, reply);
            }
          });
          ssh.end();
        },
        exit: function (code) {
          ssh.end();
        }
      }).start();
    });
  }  
  else if (text === '#ppp') {
    devices.forEach(function(device) {
      const ssh = new SSH(device.device);
      ssh.exec('ppp active print', {
        exit: function (code, stdout, stderr) {
          const lines = stdout.trim().split('\n');
          const ppps = lines.slice(2).map((line) => {
            const values = line.trim().split(/\s+/);
            return {
              name: values[2],
              service: values[3],
              remoteAddress: values[5],
              uptime: values[6],
            };
          });
          const reply = `${device.name}: There are ${ppps.length} active PPP connections:\n\n${ppps.map((ppp) => `${ppp.name} (service: ${ppp.service}, remote address: ${ppp.remoteAddress}, uptime: ${ppp.uptime})`).join('\n')}`;
          device.allowedNumbers.forEach(function(number) {
            if (msg.from.includes(number)) {
              client.sendMessage(msg.from, reply);
            }
          });
          ssh.end();
        }
      }).start();
    });
  }  
  else if (text === '#cpu') {
    devices.forEach(function(device) {
      const ssh = new SSH(device.device);
      ssh.exec('system resource print', {
        exit: function (code, stdout, stderr) {
          const lines = stdout.trim().split('\n');
          const resources = lines.slice(2).map((line) => {
            const values = line.trim().split(/\s+/);
            return {
              property: values[0],
              value: values[1],
            };
          });
          const reply = `${device.name} system resources:\n\n${resources.map((res) => `${res.property}: ${res.value}`).join('\n')}`;
          device.allowedNumbers.forEach(function(number) {
            if (msg.from.includes(number)) {
              client.sendMessage(msg.from, reply);
            }
          });
          ssh.end();
        }
      }).start();
    });
  }  
  else if (text === '#int') {
    devices.forEach(function(device) {
    const ssh = new SSH(device.device);
    ssh.exec('interface ethernet print', {
      out: function(stdout) {
        const lines = stdout.trim().split('\n');
        const interfaces = lines.slice(1).map((line) => {
          const values = line.trim().split(/\s+/);
          return {
            name: values[2],
            mtu: values[3],
            macAddress: values[4],
            link: values[1],
          };
        });
        const reply = `There are ${interfaces.length} ethernet interfaces:\n\n${interfaces.map((interface) => `${interface.name} (MAC: ${interface.macAddress}, MTU: ${interface.mtu}, Link: ${interface.link})`).join('\n')}`;
        device.allowedNumbers.forEach(function(number) {
          if (msg.from.includes(number)) {
            client.sendMessage(msg.from, reply);
          }
        });
        ssh.end();
      }
    }).start();
  });
}
else if (text === '#reboot') {
  devices.forEach(function(device) {
    const ssh = new SSH(device.device);
    ssh.exec('/system reboot', {
      out: function (stdout) {
        const reply = `Mikrotik ${device.name} sedang melakukan reboot.`;
        device.allowedNumbers.forEach(function(number) {
          if (msg.from.includes(number)) {
            client.sendMessage(msg.from, reply);
          }
        });
      },
      err: function (stderr) {
        const reply = `Error saat melakukan reboot pada Mikrotik ${device.name}: ${stderr}`;
        device.allowedNumbers.forEach(function(number) {
          if (msg.from.includes(number)) {
            client.sendMessage(msg.from, reply);
          }
        });
      },
      exit: function (code) {
        ssh.end();
      }
    }).start();
  });
}
 
  
});

client.initialize();
