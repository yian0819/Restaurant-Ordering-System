const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));

// initial MENU table
db.run(`
CREATE TABLE IF NOT EXISTS menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_price REAL NOT NULL
)
`);

// initial additional options table
db.run(`
CREATE TABLE IF NOT EXISTS menu_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  option_name TEXT NOT NULL,
  FOREIGN KEY(menu_id) REFERENCES menu(id)
)
`);

// initial orders table
db.run(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tableNumber TEXT NOT NULL,
  items TEXT NOT NULL,
  takeaway INTEGER NOT NULL,
  notes TEXT,
  extra_charge REAL,
  paid INTEGER,
  status TEXT DEFAULT '已下单',
  created_at TEXT DEFAULT (datetime('now', '+8 hours'))
)
`);

/* MENUs API */

app.get("/menu", (req, res) => {
    db.all("SELECT * FROM menu", [], (err, menus) => {
        if (err) return res.status(500).json(err);

        if (menus.length === 0) return res.json([]);

        const menuIds = menus.map(m => m.id).join(",");
        db.all(`SELECT * FROM menu_options WHERE menu_id IN (${menuIds})`, [], (err2, options) => {
            if (err2) return res.status(500).json(err2);

            const menuWithOptions = menus.map(menu => ({
                ...menu,
                options: options.filter(o => o.menu_id === menu.id)
            }));

            res.json(menuWithOptions);
        });
    });
});

app.post("/menu", (req, res) => {
    const { name, base_price } = req.body;
    if (!name || isNaN(base_price)) return res.status(400).json({ error: "name or base_price err" });

    db.run("INSERT INTO menu (name, base_price) VALUES (?, ?)", [name, base_price], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ id: this.lastID });
    });
});

app.put("/menu/:id", (req, res) => {
    const { name, base_price } = req.body;
    db.run("UPDATE menu SET name=?, base_price=? WHERE id=?", [name, base_price, req.params.id], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ updated: this.changes });
    });
});

app.delete("/menu/:id", (req, res) => {
    const menuId = req.params.id;
    db.run("DELETE FROM menu WHERE id=?", [menuId], function (err) {
        if (err) return res.status(500).json(err);
        db.run("DELETE FROM menu_options WHERE menu_id=?", [menuId]);
        res.json({ deleted: this.changes });
    });
});

app.post("/menu/:id/options", (req, res) => {
    const menuId = req.params.id;
    const { category, option_name } = req.body;
    if (!category || !option_name) return res.status(400).json({ error: "category or option_name loss" });

    db.run("INSERT INTO menu_options (menu_id, category, option_name) VALUES (?, ?, ?)", [menuId, category, option_name], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ id: this.lastID });
    });
});

app.delete("/menu/options/:option_id", (req, res) => {
    db.run("DELETE FROM menu_options WHERE id=?", [req.params.option_id], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ deleted: this.changes });
    });
});

/* orders API */

// get orders by date
app.get("/orders/date/:date", (req, res) => {
    const date = req.params.date;
    db.all(`SELECT * FROM orders WHERE DATE(created_at) = ?`, [date], (err, rows) => {
        if (err) return res.status(500).json(err);
        const orders = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
        res.json(orders);
    });
});

// get total orders and income
app.get("/orders/summary/:date", (req, res) => {
    const date = req.params.date;
    db.all(`SELECT * FROM orders WHERE DATE(created_at) = ?`, [date], (err, rows) => {
        if (err) return res.status(500).json(err);

        let totalCount = 0;
        let totalRevenue = 0;

        rows.forEach(order => {
            const items = JSON.parse(order.items);
            items.forEach(item => {
                const qty = item.quantity || 1;
                totalCount += qty;
                totalRevenue += (item.base_price || 0) * qty;
            });
            totalRevenue += order.extra_charge || 0;
        });

        res.json({ totalCount, totalRevenue });
    });
});

// get all orders
app.get("/orders", (req, res) => {
    db.all("SELECT * FROM orders", [], (err, rows) => {
        if (err) return res.status(500).json(err);
        const orders = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
        res.json(orders);
    });
});

// create an order
app.post("/orders", (req, res) => {
    const { tableNumber, items, takeaway, notes, extra_charge, paid } = req.body;
    if (!tableNumber || !items || items.length === 0) return res.status(400).json({ error: "order msg not found" });

    db.run(
        "INSERT INTO orders (tableNumber, items, takeaway, notes, extra_charge, paid) VALUES (?, ?, ?, ?, ?, ?)",
        [tableNumber, JSON.stringify(items), takeaway ? 1 : 0, notes, extra_charge || 0, paid ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json(err);
            res.json({ id: this.lastID });
        }
    );
});

// update order
app.put("/orders/:id", (req, res) => {
    const orderId = req.params.id;
    const { tableNumber, items, takeaway, notes, extra_charge, paid } = req.body;

    db.run(
        `UPDATE orders SET tableNumber=?, items=?, takeaway=?, notes=?, extra_charge=?, paid=? WHERE id=?`,
        [tableNumber, JSON.stringify(items), takeaway ? 1 : 0, notes, extra_charge || 0, paid ? 1 : 0, orderId],
        function (err) {
            if (err) return res.status(500).json({ error: "update failed" });
            res.json({ message: "update success" });
        }
    );
});

// update status of order
app.put("/orders/:id/status", (req, res) => {
    const { status } = req.body;
    db.run("UPDATE orders SET status=? WHERE id=?", [status, req.params.id], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ updated: this.changes });
    });
});

// delete order
app.delete("/orders/:id", (req, res) => {
    db.run("DELETE FROM orders WHERE id=?", [req.params.id], function (err) {
        if (err) return res.status(500).json(err);
        res.json({ deleted: this.changes });
    });
});

// 
const PORT = 5000;
app.listen(PORT, () => console.log(`hosting at http://localhost:${PORT}`));
