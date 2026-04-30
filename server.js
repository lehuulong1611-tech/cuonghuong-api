const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
        const keyword = req.query.keyword || "";
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        const pool = await sql.connect(config);

        const result = await pool.request()
            .input("keyword", sql.NVarChar, `%${keyword}%`)
            .query(`
                SELECT
                    Ten,
                    DVT,
                    Giasi,
                    SoLuongConLai
                FROM TonKho
                WHERE Ten LIKE @keyword
                ORDER BY Ten
                OFFSET ${offset} ROWS
                FETCH NEXT ${pageSize} ROWS ONLY
            `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

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
