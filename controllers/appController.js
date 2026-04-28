const puppeteer = require('puppeteer');
const { PDFDocument, rgb } = require("pdf-lib"); // ✅ use only pdf-lib
const AwsStorage = require("../service/aws-storage");

const health = (req, res) => {
    res.json({ status: 'ok' });
};

const generatePdf = async (req, res) => {
    let browser = null;

    try {
        console.log("Generating PDF...");
        // const parsedData = JSON.parse(req.body);
        const parsedData = req.body;
        const {
            app, url, device, userId, programTermId,
            termName, organizationName, programMasterName,
            programName, name, id, courseType, pdfType, folderPath
        } = parsedData;


        browser = await puppeteer.launch({
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            // page.pdf requires headless; use the modern headless mode to avoid hangs
            headless: "new",
        });

        const page = await browser.newPage();

        const deviceScaleFactor = 2;
        const width = 794;
        const height = 1123;

        await page.setViewport({ width, height, deviceScaleFactor });

        console.log("Navigating to URL...", url);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });

        console.log("Waiting for page to fully load...");
        // await page.waitForTimeout(5000);

        await new Promise(r => setTimeout(r, 5000));

        console.log("PDF Buffer generating...");


        // Generate PDF and get it as a buffer
        const pdfBuffer = await page.pdf({
            path: "result.pdf",
            format: 'A4',
            printBackground: true,
            margin: { top: '0cm', right: '0cm', bottom: '0cm', left: '0cm' },
        });

        console.log("PDF Buffer generated", name);

        const mainPdfDoc = await PDFDocument.load(pdfBuffer);
        const mergedPdfBytes = await mainPdfDoc.save();

        const awsStorage = new AwsStorage({
            accessKey: process.env.ACCESS_KEY,
            secretKey: process.env.SECRET_KEY,
            region: process.env.REGION,
        });
        const folderName =
            pdfType === 'TermDomainWise' ?
                `${organizationName}/${programMasterName}/${programName}/${termName}/domainWise` :
                pdfType === 'termBased' ?
                    `${organizationName}/${programMasterName}/${programName}/${termName}/${courseType}` :
                    pdfType === 'DomainWise' ?
                        `${organizationName}/${programMasterName}/${programName}/domainWise` :
                        pdfType === "cohortBased"
                            ? `${organizationName}/${programMasterName}/${programName}/overAll`
                            : `${organizationName}/${programMasterName}/${programName}/${termName}/${courseType}`;

        // const fileName = `${name}_${id}_${userId}_${programTermId}.pdf`;
        const fileName = `${name}_${id}_${userId}.pdf`;


        await awsStorage.uploadFileToS3({
            file: mergedPdfBytes,
            fileName,
            bucket: "lms-data-storage",
            contentType: "application/pdf",
            cacheControl: "max-age=86400,no-cache",
            contentDisposition: "inline",
            s3FolderName: folderName,
        });

        return res.json({
            success: true,
            message: "PDF with static last page generated and uploaded successfully",
        });

    } catch (error) {
        return {
            success: false,
            message: "Error generating PDF",
            error: error.message,
        };

    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn("Error closing browser:", closeError);
            }
        }
    }
};

module.exports = {
    health,
    generatePdf
};

