
console.log('Testing genkit import...');
try {
    const { ai } = require('./ai/genkit');
    console.log('genkit imported successfully');
} catch (e) {
    console.error('Failed to import genkit:', e);
}
