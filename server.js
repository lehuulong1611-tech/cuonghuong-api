const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const config = {
    user: "quanly", // tài khoản SQL
    password: "Cuonghuong@123", // mật khẩu SQL
    server: "hieusachcuonghuong.cameraddns.net",
    port: 1444,
    database: "SS-CuongHuong-2024",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// API tồn kho
app.get("/api/tonkho", async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query("SELECT TOP 10 * FROM vw_tonkho");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
})
// API Doanh số
app.get("/api/doanhso", async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query("SELECT TOP 10 * FROM vw_Doanhso");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
}
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`API đang chạy tại port ${PORT}`);
});