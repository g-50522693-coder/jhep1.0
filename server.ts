import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';

const db = new Database('jhep.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS orgPositions (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS unitFiles (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS studentForms (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
`);

// Seed initial data if empty
const seedIfEmpty = () => {
  const annCount = (db.prepare('SELECT COUNT(*) as count FROM announcements').get() as any).count;
  if (annCount === 0) {
    const initialAnnouncements = [
      {
        id: '1',
        title: 'MAKLUMAN WAKTU OPERASI PEJABAT JHEP',
        content: 'Pejabat JHEP beroperasi dari jam 8:00 pagi hingga 5:00 petang setiap hari bekerja. Sila pastikan urusan dilakukan dalam waktu tersebut.',
        date: '01/04/2026',
        author: 'Ketua JHEP',
        isImportant: true,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        title: 'PENGHANTARAN BORANG KEBAJIKAN PELAJAR',
        content: 'Semua pelajar yang ingin memohon bantuan kebajikan boleh memuat turun borang di Portal Pelajar dan menghantarnya secara digital sebelum 15 April 2026.',
        date: '02/04/2026',
        author: 'Unit Kebajikan',
        isImportant: false,
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        title: 'PROGRAM MOTIVASI & SAHSIAH PELAJAR',
        content: 'Jemputan kepada semua pelajar untuk menghadiri program motivasi yang akan diadakan di Dewan Kuliah Utama.',
        date: '03/04/2026',
        author: 'Unit Kaunseling',
        isImportant: false,
        attachments: ['https://picsum.photos/seed/jhep/800/400'],
        createdAt: new Date().toISOString()
      }
    ];
    const insert = db.prepare('INSERT INTO announcements (id, data, createdAt) VALUES (?, ?, ?)');
    initialAnnouncements.forEach(ann => insert.run(ann.id, JSON.stringify(ann), ann.createdAt));
  }

  const formCount = (db.prepare('SELECT COUNT(*) as count FROM studentForms').get() as any).count;
  if (formCount === 0) {
    const initialForms = [
      {
        id: 'f1',
        title: 'Borang Kebenaran Keluar',
        description: 'Digunakan untuk memohon kebenaran keluar dari kawasan kolej bagi urusan peribadi.',
        externalLink: 'https://docs.google.com/forms/d/e/1FAIpQLSfD-X_p8_v_x_x_x/viewform',
        createdAt: new Date().toISOString()
      },
      {
        id: 'f2',
        title: 'Borang Tuntutan Insurans',
        description: 'Borang rasmi bagi tuntutan insurans kemalangan pelajar.',
        fileData: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
        createdAt: new Date().toISOString()
      }
    ];
    const insert = db.prepare('INSERT INTO studentForms (id, data, createdAt) VALUES (?, ?, ?)');
    initialForms.forEach(form => insert.run(form.id, JSON.stringify(form), form.createdAt));
  }

  const settingsCount = (db.prepare('SELECT COUNT(*) as count FROM settings').get() as any).count;
  if (settingsCount === 0) {
    const defaultSettings = {
      departmentName: 'Jabatan Hal Ehwal Pelajar (JHEP)',
      institutionName: 'Kolej Vokasional Beaufort',
      operatingHours: 'Isnin - Jumaat: 8:00 AM - 5:00 PM',
      contactEmail: 'kvbeaufort@moe.edu.my',
      contactPhone: '087-217014',
      schoolCode: 'XHA3102',
      address: 'KM3, Jalan Beaufort - Sipitang, Peti Surat 1011, 89808 Beaufort, Sabah.',
    };
    db.prepare('INSERT INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(defaultSettings));
  }
};

seedIfEmpty();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      clients: io.engine.clientsCount,
      dbPath: path.resolve('jhep.db')
    });
  });

  // Helper to get all state
  const getFullState = () => {
    const state: any = {
      activities: db.prepare('SELECT data FROM activities ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      reports: db.prepare('SELECT data FROM reports ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      orgPositions: db.prepare('SELECT data FROM orgPositions ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      documents: db.prepare('SELECT data FROM documents ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      unitFiles: db.prepare('SELECT data FROM unitFiles ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      announcements: db.prepare('SELECT data FROM announcements ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      studentForms: db.prepare('SELECT data FROM studentForms ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      submissions: db.prepare('SELECT data FROM submissions ORDER BY createdAt DESC').all().map((r: any) => JSON.parse(r.data)),
      settings: JSON.parse((db.prepare('SELECT data FROM settings WHERE id = 1').get() as any)?.data || '{}'),
    };
    return state;
  };

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log(`[Socket.io] New connection: ${socket.id} (Total: ${io.engine.clientsCount})`);

    // Send initial state
    socket.emit('state:init', getFullState());

    // Handle initial state request
    socket.on('state:request', () => {
      console.log('Server: State requested by', socket.id);
      socket.emit('state:init', getFullState());
    });

    // Handle granular updates
    const tables = ['activities', 'reports', 'orgPositions', 'documents', 'unitFiles', 'announcements', 'studentForms', 'submissions'];
    
    tables.forEach(table => {
      socket.on(`${table}:add`, (item) => {
        console.log(`Server: Adding to ${table}`, item.id);
        try {
          db.prepare(`INSERT INTO ${table} (id, data, createdAt) VALUES (?, ?, ?)`).run(item.id, JSON.stringify(item), item.createdAt || new Date().toISOString());
          io.emit(`${table}:added`, item);
          console.log(`Server: Broadcasted ${table}:added`, item.id);
        } catch (err) {
          console.error(`Error adding to ${table}:`, err);
        }
      });

      socket.on(`${table}:update`, (item) => {
        console.log(`Server: Updating ${table}`, item.id);
        try {
          db.prepare(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(item), item.id);
          io.emit(`${table}:updated`, item);
          console.log(`Server: Broadcasted ${table}:updated`, item.id);
        } catch (err) {
          console.error(`Error updating ${table}:`, err);
        }
      });

      socket.on(`${table}:delete`, (id) => {
        console.log(`Server: Deleting from ${table}`, id);
        try {
          db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
          io.emit(`${table}:deleted`, id);
          console.log(`Server: Broadcasted ${table}:deleted`, id);
        } catch (err) {
          console.error(`Error deleting from ${table}:`, err);
        }
      });
    });

    socket.on('settings:update', (newSettings) => {
      try {
        db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(newSettings));
        io.emit('settings:updated', newSettings);
      } catch (err) {
        console.error('Error updating settings:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
