import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Start a simple Express web server to keep Heroku happy
const app = express();

app.get('/', (req, res) => {
  res.send('LiveKit SIP Agent is running - DIAGNOSTIC MODE');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the web server
app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
  
  // Start the LiveKit agent in a separate process
  const agentPath = path.join(__dirname, 'simple-agent.ts');
  console.log(`Starting diagnostic LiveKit agent from: ${agentPath}`);
  
  const agentProcess = exec(`npx tsx ${agentPath} dev`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Agent process error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Agent process stderr: ${stderr}`);
    }
    console.log(`Agent process stdout: ${stdout}`);
  });
  
  agentProcess.stdout?.on('data', (data) => {
    console.log(`Agent: ${data.toString().trim()}`);
  });
  
  agentProcess.stderr?.on('data', (data) => {
    console.error(`Agent error: ${data.toString().trim()}`);
  });
  
  agentProcess.on('close', (code) => {
    console.log(`Agent process exited with code ${code}`);
  });
  
  console.log('LiveKit diagnostic agent started in separate process');
}); 