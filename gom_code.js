const fs = require('fs');
const path = require('path');

// Thư mục gốc dự án của em
const projectPath = __dirname;
// Tên file kết quả sẽ được tạo ra
const outputFile = path.join(__dirname, 'code_cho_chi_doc.txt');

// Các thư mục cần bỏ qua để file không bị quá nặng
const ignoreDirs = ['node_modules', '.next', '.git', 'dist', 'build', 'public'];
// Các đuôi file code muốn gom (bao gồm cả package.json để xem thư viện em xài)
const allowedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];

let combinedContent = '';

function readDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Nếu là thư mục và không nằm trong danh sách bỏ qua thì đọc tiếp (đệ quy)
            if (!ignoreDirs.includes(file)) {
                readDirectory(fullPath); 
            }
        } else {
            const ext = path.extname(file);
            
            // Gom code nếu đúng đuôi file
            if (allowedExtensions.includes(ext) || file === 'package.json') {
                // Bỏ qua mấy file lock vì nó dài cả ngàn dòng không cần thiết
                if (file === 'package-lock.json' || file === 'yarn.lock' || file === 'pnpm-lock.yaml') return;
                // Bỏ qua chính file đang chạy này và file kết quả
                if (file === 'gom_code.js' || file === 'code_cho_chi_doc.txt') return;

                const relativePath = path.relative(projectPath, fullPath);
                const content = fs.readFileSync(fullPath, 'utf8');
                
                // Đánh dấu tên file cho chị dễ đọc
                combinedContent += `\n\n========================================\n`;
                combinedContent += `📍 TÊN FILE: ${relativePath}\n`;
                combinedContent += `========================================\n\n`;
                combinedContent += content;
            }
        }
    });
}

// Bắt đầu chạy
console.log("⏳ Đang gom code, Thư đợi xíu nhé...");
try {
    readDirectory(projectPath);
    fs.writeFileSync(outputFile, combinedContent);
    console.log(`✅ Gom code XONG RỒI! Em mở file "code_cho_chi_doc.txt" copy rồi gửi chị nha.`);
} catch (error) {
    console.log("❌ Có lỗi xảy ra: ", error);
}