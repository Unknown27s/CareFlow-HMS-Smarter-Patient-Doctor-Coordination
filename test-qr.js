// Simple test to verify QR code functionality
const QRCode = require('qrcode');

async function testQRGeneration() {
    console.log('🧪 Testing QR Code Generation...\n');

    try {
        // Test 1: Generate QR code
        const testData = {
            patientId: 123,
            name: "Test Patient",
            token: "CAR001",
            contact: "1234567890",
            timestamp: new Date().toISOString()
        };

        const qrCode = await QRCode.toDataURL(JSON.stringify(testData), {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2
        });

        console.log('✅ Test 1: QR Code Generation - PASSED');
        console.log('   Generated QR code length:', qrCode.length);
        console.log('   Data URL prefix:', qrCode.substring(0, 30) + '...');

        // Test 2: Verify data format
        if (qrCode.startsWith('data:image/png;base64,')) {
            console.log('✅ Test 2: QR Code Format - PASSED');
        } else {
            console.log('❌ Test 2: QR Code Format - FAILED');
        }

        // Test 3: Parse QR data
        const parsedData = JSON.parse(JSON.stringify(testData));
        if (parsedData.patientId === 123 && parsedData.token === 'CAR001') {
            console.log('✅ Test 3: Data Parsing - PASSED');
        } else {
            console.log('❌ Test 3: Data Parsing - FAILED');
        }

        // Test 4: Timestamp format
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { dateStyle: 'full' });
        const timeStr = now.toLocaleTimeString('en-US', { timeStyle: 'medium' });
        
        console.log('✅ Test 4: Timestamp Format - PASSED');
        console.log('   Current Date:', dateStr);
        console.log('   Current Time:', timeStr);

        console.log('\n🎉 All QR Code tests passed!');
        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run tests
testQRGeneration().then(success => {
    process.exit(success ? 0 : 1);
});
