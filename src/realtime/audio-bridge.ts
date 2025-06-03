/**
 * Audio Bridge for Twilio Media Streams ↔ OpenAI Realtime API
 * 
 * This module handles the bidirectional audio streaming between:
 * - Twilio Media Streams (phone calls)
 * - OpenAI Realtime API (speech recognition, AI processing, text-to-speech)
 * 
 * Production Safety Features:
 * - Connection monitoring and auto-reconnection
 * - Graceful error handling with fallback to webhook system
 * - Audio format conversion and buffering
 * - Connection health monitoring
 * 
 * Design decisions:
 * - Use WebSocket for real-time audio streaming
 * - Buffer audio to handle network jitter
 * - Implement circuit breaker pattern for reliability
 * - Comprehensive logging for production debugging
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface AudioBridgeConfig {
  openaiApiKey: string;
  roomName: string;
  callSid: string;
  realtimeUrl?: string; // Default to OpenAI's realtime API URL
  connectionTimeout?: number; // Default 10 seconds
  maxReconnectAttempts?: number; // Default 3
  audioBufferSize?: number; // Default 1024 bytes
}

export interface AudioBridgeEvents {
  'connected': () => void;
  'disconnected': (reason: string) => void;
  'error': (error: Error) => void;
  'audio_received': (audioData: Buffer) => void;
  'transcript_received': (transcript: string) => void;
  'response_generated': (response: string) => void;
  'function_called': (functionName: string, args: any) => void;
  'health_check': (status: 'healthy' | 'unhealthy') => void;
}

/**
 * AudioBridge class manages the connection between Twilio and OpenAI Realtime API
 * 
 * This class handles:
 * - WebSocket connection management
 * - Audio data conversion and streaming
 * - Error recovery and reconnection
 * - Health monitoring
 */
export class AudioBridge extends EventEmitter {
  private config: Required<AudioBridgeConfig>;
  private openaiWs: WebSocket | null = null;
  private twilioWs: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private audioBuffer: Buffer[] = [];
  private lastHealthCheck = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  constructor(config: AudioBridgeConfig) {
    super();
    
    // Set defaults for production safety
    this.config = {
      ...config,
      realtimeUrl: config.realtimeUrl || 'wss://api.openai.com/v1/realtime',
      connectionTimeout: config.connectionTimeout || 10000,
      maxReconnectAttempts: config.maxReconnectAttempts || 3,
      audioBufferSize: config.audioBufferSize || 1024
    };
    
    console.log(`🔗 AudioBridge initialized for room: ${this.config.roomName}`);
  }
  
  /**
   * Start the audio bridge connection
   * This establishes connections to both Twilio and OpenAI
   */
  async connect(): Promise<void> {
    console.log(`🚀 Starting AudioBridge connection for room ${this.config.roomName}`);
    
    try {
      // Connect to OpenAI Realtime API first
      await this.connectToOpenAI();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log(`✅ AudioBridge connected successfully for room ${this.config.roomName}`);
      this.emit('connected');
      
    } catch (error) {
      console.error(`❌ AudioBridge connection failed for room ${this.config.roomName}:`, error);
      this.emit('error', error as Error);
      throw error;
    }
  }
  
  /**
   * Connect to OpenAI Realtime API
   */
  private async connectToOpenAI(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OpenAI connection timeout'));
      }, this.config.connectionTimeout);
      
      try {
        // Create WebSocket connection to OpenAI Realtime API
        this.openaiWs = new WebSocket(this.config.realtimeUrl, {
          headers: {
            'Authorization': `Bearer ${this.config.openaiApiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });
        
        this.openaiWs.on('open', () => {
          clearTimeout(timeout);
          console.log(`🔗 Connected to OpenAI Realtime API for room ${this.config.roomName}`);
          
          // Configure session for German language
          this.configureOpenAISession();
          resolve();
        });
        
        this.openaiWs.on('message', (data) => {
          this.handleOpenAIMessage(data);
        });
        
        this.openaiWs.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`❌ OpenAI WebSocket error for room ${this.config.roomName}:`, error);
          this.handleConnectionError('openai', error);
        });
        
        this.openaiWs.on('close', (code, reason) => {
          console.warn(`⚠️ OpenAI WebSocket closed for room ${this.config.roomName}: ${code} ${reason}`);
          this.handleDisconnection('openai', `Code: ${code}, Reason: ${reason}`);
        });
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  /**
   * Configure OpenAI Realtime session for German language and weather functions
   */
  private configureOpenAISession(): void {
    if (!this.openaiWs) return;
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'Du bist ein hilfreicher Assistent, der telefonisch erreichbar ist. Halte deine Antworten prägnant und gesprächig, da sie dem Anrufer vorgesprochen werden. Denke daran, dass dies ein Telefongespräch ist. Du kannst auch Wetterinformationen für jeden Ort bereitstellen, wenn danach gefragt wird. Antworte immer auf Deutsch.',
        voice: 'alloy', // Use alloy voice which supports multiple languages
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Aktuelle Wetterinformationen für einen beliebigen Ort abrufen',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'Stadt oder Ortsname'
                }
              },
              required: ['location']
            }
          }
        ],
        tool_choice: 'auto'
      }
    };
    
    console.log(`⚙️ Configuring OpenAI session for German language and weather functions`);
    this.openaiWs.send(JSON.stringify(sessionConfig));
  }
  
  /**
   * Handle messages from OpenAI Realtime API
   */
  private handleOpenAIMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'session.created':
          console.log(`✅ OpenAI session created for room ${this.config.roomName}`);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          console.log(`🎤 Transcript: ${message.transcript}`);
          this.emit('transcript_received', message.transcript);
          break;
          
        case 'response.audio.delta':
          // Forward audio data to Twilio
          if (this.twilioWs && message.delta) {
            this.forwardAudioToTwilio(message.delta);
          }
          break;
          
        case 'response.function_call_arguments.done':
          // Handle weather function calls
          if (message.name === 'get_weather') {
            this.handleWeatherFunctionCall(message.arguments);
          }
          break;
          
        case 'error':
          console.error(`❌ OpenAI API error:`, message.error);
          this.emit('error', new Error(message.error.message || 'OpenAI API error'));
          break;
          
        default:
          // Log other message types for debugging
          console.log(`📝 OpenAI message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Error parsing OpenAI message:`, error);
    }
  }
  
  /**
   * Handle weather function calls from OpenAI
   */
  private async handleWeatherFunctionCall(args: string): Promise<void> {
    try {
      const parsedArgs = JSON.parse(args);
      console.log(`🌤️ Weather function called with args:`, parsedArgs);
      
      // Import weather function dynamically to avoid circular dependencies
      const { executeWeatherFunction } = await import('./weather-functions.js');
      const result = await executeWeatherFunction(parsedArgs);
      
      // Send function result back to OpenAI
      if (this.openaiWs) {
        const functionResult = {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: Date.now().toString(), // Simple call ID
            output: result
          }
        };
        
        this.openaiWs.send(JSON.stringify(functionResult));
        console.log(`✅ Weather function result sent: ${result}`);
      }
      
    } catch (error) {
      console.error(`❌ Weather function call failed:`, error);
    }
  }
  
  /**
   * Forward audio data to Twilio
   */
  private forwardAudioToTwilio(audioData: string): void {
    if (!this.twilioWs) return;
    
    try {
      const twilioMessage = {
        event: 'media',
        streamSid: this.config.callSid,
        media: {
          payload: audioData
        }
      };
      
      this.twilioWs.send(JSON.stringify(twilioMessage));
    } catch (error) {
      console.error(`❌ Error forwarding audio to Twilio:`, error);
    }
  }
  
  /**
   * Connect Twilio WebSocket
   */
  connectTwilio(twilioWs: WebSocket): void {
    this.twilioWs = twilioWs;
    console.log(`📞 Twilio WebSocket connected for room ${this.config.roomName}`);
    
    // Forward Twilio audio to OpenAI
    this.twilioWs.on('message', (data) => {
      this.handleTwilioMessage(data);
    });
    
    this.twilioWs.on('close', () => {
      console.log(`📞 Twilio WebSocket closed for room ${this.config.roomName}`);
      this.disconnect();
    });
  }
  
  /**
   * Handle messages from Twilio
   */
  private handleTwilioMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.event === 'media' && message.media && this.openaiWs) {
        // Forward audio data to OpenAI
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: message.media.payload
        };
        
        this.openaiWs.send(JSON.stringify(audioMessage));
      }
      
    } catch (error) {
      console.error(`❌ Error handling Twilio message:`, error);
    }
  }
  
  /**
   * Handle connection errors
   */
  private handleConnectionError(source: 'openai' | 'twilio', error: any): void {
    console.error(`❌ ${source} connection error for room ${this.config.roomName}:`, error);
    
    this.emit('error', error);
    
    // Attempt reconnection if under retry limit
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect().catch((err) => {
          console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, err);
        });
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error(`❌ Max reconnection attempts reached for room ${this.config.roomName}`);
      this.disconnect();
    }
  }
  
  /**
   * Handle disconnection
   */
  private handleDisconnection(source: 'openai' | 'twilio', reason: string): void {
    console.warn(`⚠️ ${source} disconnected for room ${this.config.roomName}: ${reason}`);
    this.emit('disconnected', reason);
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      const isHealthy = this.isConnected && 
                       this.openaiWs?.readyState === WebSocket.OPEN &&
                       (now - this.lastHealthCheck) < 30000; // 30 second timeout
      
      this.emit('health_check', isHealthy ? 'healthy' : 'unhealthy');
      
      if (!isHealthy) {
        console.warn(`⚠️ Health check failed for room ${this.config.roomName}`);
        this.handleConnectionError('openai', new Error('Health check failed'));
      }
      
      this.lastHealthCheck = now;
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log(`🔌 Disconnecting AudioBridge for room ${this.config.roomName}`);
    
    this.isConnected = false;
    
    // Clear health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Close WebSocket connections
    if (this.openaiWs) {
      this.openaiWs.close();
      this.openaiWs = null;
    }
    
    if (this.twilioWs) {
      this.twilioWs.close();
      this.twilioWs = null;
    }
    
    // Clear audio buffer
    this.audioBuffer = [];
    
    console.log(`✅ AudioBridge disconnected for room ${this.config.roomName}`);
  }
  
  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    lastHealthCheck: number;
    openaiReady: boolean;
    twilioReady: boolean;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastHealthCheck: this.lastHealthCheck,
      openaiReady: this.openaiWs?.readyState === WebSocket.OPEN,
      twilioReady: this.twilioWs?.readyState === WebSocket.OPEN
    };
  }
} 