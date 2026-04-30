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

        const startRow = (page - 1) * pageSize + 1;
        const endRow = page * pageSize;

        const pool = await sql.connect(config);

        const result = await pool.request()
            .input("keyword", sql.NVarChar, `%${keyword}%`)
            .query(`
                WITH DataCTE AS (
                    SELECT
                        ROW_NUMBER() OVER (ORDER BY Ten) AS RowNum,
                        Ten,
                        DVT,
                        Giasi,
                        SoLuongConLai
                    FROM vw_tonkho
                    WHERE Ten LIKE @keyword
                )
                SELECT
                    Ten,
                    DVT,
                    Giasi,
                    SoLuongConLai
                FROM DataCTE
                WHERE RowNum BETWEEN ${startRow} AND ${endRow}
                ORDER BY RowNum
            `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

// API Doanh số
app.get("/api/doanhso", async (req, res) => {
    try {
        const type = req.query.type || "day"; // day | month

        const pool = await sql.connect(config);

        let dateCondition = "";

        if (type === "month") {
            dateCondition = `
                MONTH(NgayCT) = MONTH(GETDATE())
                AND YEAR(NgayCT) = YEAR(GETDATE())
            `;
        } else {
            dateCondition = `
                CAST(NgayCT AS DATE) = CAST(GETDATE() AS DATE)
            `;
        }

        const result = await pool.request()
            .query(`
                SELECT
                    Tennv,
                    SUM(
                        CASE 
                            WHEN LoaiCT IN ('HDBB', 'HDBL') THEN 1
                            WHEN LoaiCT = 'HHTL' THEN -1
                            ELSE 0
                        END
                    ) AS SoLuongDon,

                    SUM(
                        CASE
                            WHEN LoaiCT IN ('HDBB', 'HDBL') THEN ThanhTien
                            WHEN LoaiCT = 'HHTL' THEN -ThanhTien
                            ELSE 0
                        END
                    ) AS TongTien
                FROM vw_doanhso
                WHERE ${dateCondition}
                GROUP BY Tennv
                ORDER BY TongTien DESC
            `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`API đang chạy tại port ${PORT}`);
});
