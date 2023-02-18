const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const SSH = require('simple-ssh');

const client = new Client({
  authStrategy: new LocalAuth()
});

const device = {
  host: '103.154.88.109', // Replace with your MikroTik router's IP address
  port: 2223,
  user: 'admin', // Replace with your MikroTik username
  pass: '009988' // Replace with your MikroTik password
};

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async msg => {
  const text = msg.body.toLowerCase() || '';

  if (text === '!ping') {
    msg.reply('pong');
  }
  else if (text === '!menu') {
    const menu = 'Silahkan pilih menu:\n1. #ping/google.com untuk ping\n2. #int Tampilkan Interface\n3. #cpu Tampilkan System Resource\n4. #ppp_active menampilkan PPP Active\n';
    msg.reply(menu);
  }
  else if (text.includes("#ping/")) {
    const parts = text.split("/");
    const target = parts[1];
    const ssh = new SSH(device);
    ssh.exec(`ping ${target} count=4`, {
      out: function (stdout) {
        msg.reply(stdout);
      },
      err: function (stderr) {
        msg.reply(stderr);
      },
      exit: function (code) {
        ssh.end();
      }
    }).start();
  }
  else if (text === '#ppp_active') {
    const ssh = new SSH(device);
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
        const reply = `There are ${ppps.length} active PPP connections:\n\n${ppps.map((ppp) => `${ppp.name} (service: ${ppp.service}, remote address: ${ppp.remoteAddress}, uptime: ${ppp.uptime})`).join('\n')}`;
        msg.reply(reply);
        ssh.end();
      }
    }).start();
  }
  else if (text === '#cpu') {
    const ssh = new SSH(device);
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
        const reply = `System resources:\n\n${resources.map((res) => `${res.property}: ${res.value}`).join('\n')}`;
        msg.reply(reply);
        ssh.end();
      }
    }).start();
  }
  else if (text === '#int') {
    const ssh = new SSH(device);
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
        msg.reply(reply);
        ssh.end();
      }
    }).start();
  }
  else if (text === '#reboot') {
    const ssh = new SSH(device);
    ssh.exec('/system reboot', {
      out: function (stdout) {
        msg.reply('Mikrotik sedang melakukan reboot.');
      },
      err: function (stderr) {
        msg.reply(stderr);
      },
      exit: function (code) {
        ssh.end();
      }
    }).start();
  }  
  
});

client.initialize();
