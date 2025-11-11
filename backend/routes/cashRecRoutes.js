const express = require('express');
// const SftpClient = require('ssh2-sftp-client');
const { withSftp } = require('../utils/sftp')
const { parseSftReport } = require('../utils/parseSftReport')
const { getSftpConfig } = require('../config/sftpConfig')

const router = express.Router();

// const SFTP_CONFIG = {
//   host: process.env.SFTP_HOST || '205.211.164.97',
//   port: process.env.SFTP_PORT || '24',
//   username: process.env.SFTP_USER || 'ind00731-bk',
//   password: process.env.SFTP_PASS || '9d2rYetVF6',
// };

// Retryable per-request SFTP helper
// const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// async function withSftp(fn, attempts = 3) {
//   let lastErr;
//   for (let i = 0; i < attempts; i++) {
//     const sftp = new SftpClient();
//     try {
//       await sftp.connect(SFTP_CONFIG);
//       const result = await fn(sftp);
//       await sftp.end().catch(() => {});
//       return result;
//     } catch (err) {
//       lastErr = err;
//       await sftp.end().catch(() => {});
//       if (i < attempts - 1) {
//         await delay(200 * Math.pow(2, i)); // backoff: 200ms, 400ms
//       }
//     }
//   }
//   throw lastErr;
// }

router.get('/receive', async (req, res) => {
  const { site } = req.query

  if (!getSftpConfig(site)) {
    return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
  }

  try {
    const files = await withSftp(site, async (sftp) => {
      const remoteDir = '/receive'
      const list = await sftp.list(remoteDir)

      return list
        .filter((f) => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.sft'))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map((f) => ({
          name: f.name,
          size: f.size,
          modifyTime: f.modifyTime,
          accessTime: f.accessTime,
          type: f.type,
          path: `${remoteDir}/${f.name}`,
        }))
    })

    res.json({ files })
  } catch (err) {
    console.error('SFTP list error:', err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

router.get('/receive/:shift', async (req, res) => {
  const { site } = req.query

  if (!getSftpConfig(site)) {
    return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
  }

  const { shift } = req.params
  if (!/^\d+$/.test(shift)) {
    return res.status(400).json({ error: 'Invalid shift' })
  }

  try {
    const result = await withSftp(site, async (sftp) => {
      const remoteDir = '/receive'
      const list = await sftp.list(remoteDir)

      const target = list.find(
        (f) =>
          typeof f.name === 'string' &&
          f.name.toLowerCase().endsWith('.sft') &&
          new RegExp(`\\b${shift}\\.sft$`).test(f.name)
      )

      if (!target) return { status: 404 }

      const remotePath = `${remoteDir}/${target.name}`
      const fileBuf = await sftp.get(remotePath)
      const content = fileBuf.toString('utf8')
      const metrics = parseSftReport(content)

      return {
        status: 200,
        data: { shift, name: target.name, content, metrics },
      }
    })

    if (result.status === 404) return res.status(404).json({ error: 'Shift file not found' })
    res.json(result.data)
  } catch (err) {
    console.error('SFTP read error:', err)
    res.status(500).json({ error: 'Failed to read shift file' })
  }
})

// router.get('/receive', async (req, res) => {
//   try {
//     const files = await withSftp(async (sftp) => {
//       const remoteDir = '/receive';
//       const list = await sftp.list(remoteDir);

//       // Only include .sft files and sort by full filename (desc) to reflect timestamp order
//       const sftFiles = list
//         .filter((f) => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.sft'))
//         .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
//         .map((f) => ({
//           name: f.name,
//           size: f.size,
//           modifyTime: f.modifyTime,
//           accessTime: f.accessTime,
//           type: f.type,
//           path: `${remoteDir}/${f.name}`,
//         }));

//       return sftFiles;
//     });

//     res.json({ files });
//   } catch (err) {
//     console.error('SFTP list error:', err);
//     res.status(500).json({ error: 'Failed to list files' });
//   }
// });

// router.get('/receive/:shift', async (req, res) => {
//   const { shift } = req.params;
//   if (!/^\d+$/.test(shift)) {
//     return res.status(400).json({ error: 'Invalid shift' });
//   }

//   try {
//     const result = await withSftp(async (sftp) => {
//       const remoteDir = '/receive';
//       const list = await sftp.list(remoteDir);

//       const target = list.find(
//         (f) =>
//           typeof f.name === 'string' &&
//           f.name.toLowerCase().endsWith('.sft') &&
//           new RegExp(`\\b${shift}\\.sft$`).test(f.name)
//       );

//       if (!target) {
//         return { status: 404 };
//       }

//       const remotePath = `${remoteDir}/${target.name}`;
//       const fileBuf = await sftp.get(remotePath);
//       const content = fileBuf.toString('utf8');
//       const metrics = parseSftReport(content);

//       return {
//         status: 200,
//         data: {
//           shift,
//           name: target.name,
//           content,
//           metrics,
//         },
//       };
//     });

//     if (result.status === 404) {
//       return res.status(404).json({ error: 'Shift file not found' });
//     }

//     res.json(result.data);
//   } catch (err) {
//     console.error('SFTP read error:', err);
//     res.status(500).json({ error: 'Failed to read shift file' });
//   }
// });

module.exports = router;