const PDFDocument = require('pdfkit');
const path = require('path');

class SalesReportPDFGenerator {
    constructor(reportData) {
        this.reportData = reportData;
        this.doc = new PDFDocument({ margin: 50 });
    }

    async generatePDF() {
        try {
            // Add header and title
            this.addHeader();
            
            // Add summary section
            this.addSummaryTable();
            
            // Add daily breakdown
            this.addDailyBreakdown();
            
            // Add popular products
            this.addPopularProducts();
            
            // Finalize the PDF
            this.doc.end();
            return this.doc;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw new Error('Failed to generate PDF report');
        }
    }

    addHeader() {
        // Add logo
        const logoPath = path.join(__dirname, '../public/images/logo/logo.png');
        this.doc.image(logoPath, 50, 45, { width: 50 })
            .fillColor('#444444')
            .fontSize(20)
            .text('Sales Report', 110, 57)
            .fontSize(10)
            .text(new Date().toLocaleString(), 200, 65, { align: 'right' })
            .moveDown();

        // Add date range
        this.doc.fontSize(10)
            .text(`Report Period: ${new Date(this.reportData.dateRange.start).toLocaleDateString()} to ${new Date(this.reportData.dateRange.end).toLocaleDateString()}`, {
                align: 'right'
            })
            .moveDown();
    }

    addSummaryTable() {
        this.doc.fontSize(16)
            .text('Summary', 50, 150)
            .moveDown();

        const summary = this.reportData.summary;
        const summaryData = [
            ['Total Orders', summary.totalOrders],
            ['Total Sales', `$${summary.totalSales.toFixed(2)}`],
            ['Total Shipping', `$${summary.totalShipping.toFixed(2)}`],
            ['Orders with Discount', summary.discountedOrders],
            ['Total Discount Amount', `$${summary.totalDiscount.toFixed(2)}`]
        ];

        this.createTable(
            ['Metric', 'Value'],
            summaryData,
            50,
            180
        );
    }

    addDailyBreakdown() {
        this.doc.addPage();
        
        this.doc.fontSize(16)
            .text('Daily Breakdown', 50, 50)
            .moveDown();

        const tableHeaders = ['Date', 'Orders', 'Revenue', 'Discount'];
        const tableData = this.reportData.dailyBreakdown.map(day => [
            day._id,
            day.orders.toString(),
            `$${day.revenue.toFixed(2)}`,
            `$${day.discount.toFixed(2)}`
        ]);

        this.createTable(
            tableHeaders,
            tableData,
            50,
            80
        );
    }

    addPopularProducts() {
        this.doc.addPage();
        
        this.doc.fontSize(16)
            .text('Popular Products', 50, 50)
            .moveDown();

        const tableHeaders = ['Product', 'Quantity Sold', 'Revenue'];
        const tableData = this.reportData.popularProducts.map(product => [
            product.productDetails[0]?.productName || 'N/A',
            product.totalQuantity.toString(),
            `$${product.totalRevenue.toFixed(2)}`
        ]);

        this.createTable(
            tableHeaders,
            tableData,
            50,
            80
        );
    }

    createTable(headers, data, x, y) {
        const columnCount = headers.length;
        const columnWidth = (this.doc.page.width - 100) / columnCount;
        const rowHeight = 30;
        let currentY = y;

        // Draw headers
        headers.forEach((header, i) => {
            this.doc
                .fontSize(10)
                .fillColor('#444444')
                .rect(x + (i * columnWidth), currentY - 10, columnWidth, rowHeight)
                .fill('#E4E4E4')
                .fillColor('#000000')
                .text(header, x + (i * columnWidth) + 5, currentY);
        });

        currentY += rowHeight;

        // Draw data rows
        data.forEach((row, rowIndex) => {
            // Add new page if content exceeds page height
            if (currentY > this.doc.page.height - 50) {
                this.doc.addPage();
                currentY = 50;
                
                // Redraw headers on new page
                headers.forEach((header, i) => {
                    this.doc
                        .fontSize(10)
                        .fillColor('#444444')
                        .rect(x + (i * columnWidth), currentY - 10, columnWidth, rowHeight)
                        .fill('#E4E4E4')
                        .fillColor('#000000')
                        .text(header, x + (i * columnWidth) + 5, currentY);
                });
                currentY += rowHeight;
            }

            // Draw row background
            this.doc
                .rect(x, currentY - 10, columnWidth * columnCount, rowHeight)
                .fill(rowIndex % 2 === 0 ? '#FFFFFF' : '#F9F9F9');

            // Draw cell data
            row.forEach((cell, i) => {
                this.doc
                    .fontSize(10)
                    .fillColor('#000000')
                    .text(cell.toString(), x + (i * columnWidth) + 5, currentY);
            });

            currentY += rowHeight;
        });

        // Draw table border
        this.doc
            .rect(x, y - 10, columnWidth * columnCount, currentY - y + 10)
            .stroke();

        return currentY;
    }
}

module.exports = SalesReportPDFGenerator;