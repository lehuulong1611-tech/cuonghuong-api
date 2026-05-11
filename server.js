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
        const type = req.query.type || "day";

        const pool = await sql.connect(config);

       let dateCondition = "";

if (type === "month") {
    dateCondition = `
        MONTH(Ngay) = MONTH(GETDATE())
        AND YEAR(Ngay) = YEAR(GETDATE())
    `;
} else if (type === "3days") {
    dateCondition = `
        CAST(Ngay AS DATE) >= DATEADD(DAY, -2, CAST(GETDATE() AS DATE))
    `;
} else {
    dateCondition = `
        CAST(Ngay AS DATE) = CAST(GETDATE() AS DATE)
    `;
}

        const result = await pool.request()
            .query(`
                SELECT
                    Tennv,

                    COUNT(DISTINCT CASE
                        WHEN LoaiCT IN ('HDBB', 'HDBL')
                        THEN Chung_Tu
                    END) AS SoDonBan,

                    COUNT(DISTINCT CASE
                        WHEN LoaiCT = 'HHTL'
                        THEN Chung_Tu
                    END) AS SoDonTraLai,

                    SUM(CASE
                        WHEN LoaiCT IN ('HDBB', 'HDBL') THEN ThanhTien
                        WHEN LoaiCT = 'HHTL' THEN -ThanhTien
                        ELSE 0
                    END) AS TongTien

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

// API Doanh số khách hàng
app.get("/api/doanhso/khachhang", async (req, res) => {
    try {
        const { nhanvien, type } = req.query;
        const page = parseInt(req.query.page) || 1;
        const pageSize = 15;
        const offset = (page - 1) * pageSize;

        const pool = await sql.connect(config);

        let dateCondition = "";

        if (type === "month") {
            dateCondition = `MONTH(Ngay)=MONTH(GETDATE()) AND YEAR(Ngay)=YEAR(GETDATE())`;
        } else if (type === "3days") {
            dateCondition = `CAST(Ngay AS DATE) >= DATEADD(DAY, -2, CAST(GETDATE() AS DATE))`;
        } else {
            dateCondition = `CAST(Ngay AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request().query(`
    WITH Data AS (
        SELECT
            KhachHang,

            COUNT(DISTINCT CASE
                WHEN LoaiCT IN ('HDBB','HDBL') THEN Chung_tu
            END) AS SoDonBan,

            COUNT(DISTINCT CASE
                WHEN LoaiCT = 'HHTL' THEN Chung_tu
            END) AS SoDonTra,

            SUM(CASE
                WHEN LoaiCT IN ('HDBB','HDBL') THEN ThanhTien
                WHEN LoaiCT='HHTL' THEN -ThanhTien
                ELSE 0
            END) AS ThanhTien

        FROM vw_doanhso
        WHERE ${dateCondition}
          AND Tennv = N'${nhanvien}'

        GROUP BY KhachHang
    ),

    DataCTE AS (
        SELECT *,
            ROW_NUMBER() OVER (ORDER BY ThanhTien DESC) AS RowNum
        FROM Data
    )

    SELECT *
    FROM DataCTE
    WHERE RowNum BETWEEN ${offset + 1} AND ${offset + pageSize}
`);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//API xử lý chi tiết thuế khách hàng
app.get("/api/xlthue/chungtu", async (req, res) => {
    try {
        const { khachhang, from, to } = req.query;

        const pool = await sql.connect(config);

        const result = await pool.request()
        .input("khachhang", sql.NVarChar, khachhang)
        .input("from", sql.Date, from)
        .input("to", sql.Date, to)
        .query(`
            SELECT 
                c.KhachHang,
                c.Chung_tu,
                c.Ngay,
                SUM(c.ThanhTien) AS ThanhTien,

                t.Tinhtrang,
                t.Ngaycapnhat

            FROM vw_Chitietdonthue c
            LEFT JOIN dbo.HoaDonThue_TrangThai t
                ON c.Chung_tu = t.Chung_tu 
                AND c.KhachHang = t.Makhach

            WHERE c.KhachHang = @khachhang
              AND c.Ngay BETWEEN @from AND @to

            GROUP BY 
                c.KhachHang,
                c.Chung_tu,
                c.Ngay,
                t.Tinhtrang,
                t.Ngaycapnhat

            ORDER BY c.Ngay DESC
        `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

//API xử lý chi tiết đơn thuế khách hàng
app.post("/api/xlthue/save-vat", async (req, res) => {
    try {
        const { khachhang, data } = req.body;

        const pool = await sql.connect(config);

        if (!khachhang || !data || !Array.isArray(data)) {
            return res.status(400).json({ ok: false, message: "Invalid data" });
        }

        for (const item of data) {

            const status = item.checked ? "đã xuất" : "đã hủy VAT";
            const chung_tu = item.chung_tu;

            const check = await pool.request()
                .input("Makhach", sql.NVarChar, khachhang)
                .input("Chung_tu", sql.NVarChar, chung_tu)
                .query(`
                    SELECT 1 FROM dbo.HoaDonThue_TrangThai
                    WHERE Makhach = @Makhach AND Chung_tu = @Chung_tu
                `);

            if (check.recordset.length > 0) {

                // UPDATE
                await pool.request()
                    .input("Makhach", sql.NVarChar, khachhang)
                    .input("Chung_tu", sql.NVarChar, chung_tu)
                    .input("status", sql.NVarChar, status)
                    .query(`
                        UPDATE dbo.HoaDonThue_TrangThai
                        SET Tinhtrang = @status,
                            Ngaycapnhat = GETDATE()
                        WHERE Makhach = @Makhach AND Chung_tu = @Chung_tu
                    `);

            } else {

                // INSERT
                await pool.request()
                    .input("Makhach", sql.NVarChar, khachhang)
                    .input("Chung_tu", sql.NVarChar, chung_tu)
                    .input("status", sql.NVarChar, status)
                    .query(`
                        INSERT INTO dbo.HoaDonThue_TrangThai
                        (Manv, Makhach, Chung_tu, Ngaycapnhat, Tinhtrang)
                        VALUES
                        ('ketoan', @Makhach, @Chung_tu, GETDATE(), @status)
                    `);
            }
        }

        res.json({ ok: true, message: "Saved VAT successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: err.message });
    }
});



//API xử lý thuế khách hàng
app.get("/api/xlthue/khach", async (req, res) => {
    try {
        const { from, to } = req.query;

        const pool = await sql.connect(config);

        const result = await pool.request()
        .input("from", sql.Date, from)
        .input("to", sql.Date, to)
        .query(`
            SELECT 
                a.KhachHang,
                a.MST,
                a.Ten_HoaDon,

                COUNT(DISTINCT CASE 
                    WHEN a.LoaiCT = 'HDBB' THEN a.Chung_tu 
                END) AS SoDonBan,

                COUNT(DISTINCT CASE 
                    WHEN a.LoaiCT = 'HHTL' THEN a.Chung_tu 
                END) AS SoDonTra,

                SUM(CASE 
                    WHEN a.LoaiCT = 'HDBB' THEN a.ThanhTien
                    WHEN a.LoaiCT = 'HHTL' THEN -a.ThanhTien
                    ELSE 0
                END) AS TongTien

            FROM vw_Chitietdonthue a
            WHERE a.Ngay BETWEEN @from AND @to
            GROUP BY 
                a.KhachHang,
                a.MST,
                a.Ten_HoaDon
            ORDER BY TongTien DESC
        `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).send(err.message);
    }
});


//API Doanh số hàng hóa
app.get("/api/doanhso/hanghoa", async (req, res) => {
    try {
        const { nhanvien, khachhang, type } = req.query;
        const page = parseInt(req.query.page) || 1;
        const pageSize = 15;
        const offset = (page - 1) * pageSize;

        const pool = await sql.connect(config);

        let dateCondition = "";

        if (type === "month") {
            dateCondition = `MONTH(Ngay)=MONTH(GETDATE()) AND YEAR(Ngay)=YEAR(GETDATE())`;
        } else if (type === "3days") {
            dateCondition = `CAST(Ngay AS DATE) >= DATEADD(DAY, -2, CAST(GETDATE() AS DATE))`;
        } else {
            dateCondition = `CAST(Ngay AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request().query(`
    WITH Data AS (
        SELECT
            TenHang,

            SUM(CASE WHEN LoaiCT IN ('HDBB','HDBL') THEN So_Luong ELSE 0 END) AS SLBan,
            SUM(CASE WHEN LoaiCT = 'HHTL' THEN So_Luong ELSE 0 END) AS SLTra,

            AVG(Dongia) AS DonGia,

            SUM(CASE
                WHEN LoaiCT IN ('HDBB','HDBL') THEN ThanhTien
                WHEN LoaiCT='HHTL' THEN -ThanhTien
                ELSE 0
            END) AS ThanhTien

        FROM vw_doanhso
        WHERE ${dateCondition}
          AND Tennv = N'${nhanvien}'
          AND KhachHang = N'${khachhang}'

        GROUP BY TenHang
    ),

    DataCTE AS (
        SELECT *,
            ROW_NUMBER() OVER (ORDER BY ThanhTien DESC) AS RowNum
        FROM Data
    )

    SELECT *
    FROM DataCTE
    WHERE RowNum BETWEEN ${offset + 1} AND ${offset + pageSize}
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
