/**
 * Uses MQTT over WebSockets with EMQX Broker.
 * Implements "Retained Messages" pattern:
 * - Host publishes state with `retain: true`.
 * - Players connecting immediately receive the last retained state without needing a handshake.
 */

import mqtt from 'mqtt';

type MessageType = 'JOIN_REQUEST' | 'STATE_UPDATE' | 'TIMER_UPDATE' | 'SUBMIT_ANSWER' | 'START_GAME' | 'NEXT_QUESTION' | 'KICK_PLAYER';

interface NetworkMessage {
  type: MessageType;
  pin: string;
  payload: any;
}

class NetworkService {
  private client: mqtt.MqttClient | null = null;
  private pin: string | null = null;
  private role: 'HOST' | 'PLAYER' | null = null;
  private listeners: ((msg: NetworkMessage) => void)[] = [];

  // EMQX Public Broker (Professional grade, supports WSS)
  private readonly BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

  connect(pin: string, role: 'HOST' | 'PLAYER') {
    if (this.client) this.disconnect(); // Clean slate

    this.pin = pin;
    this.role = role;

    console.log(`[Net] Connecting to ${this.BROKER_URL} as ${role} for PIN ${pin}...`);

    this.client = mqtt.connect(this.BROKER_URL, {
      clientId: `genquiz_${role}_${Math.random().toString(16).substr(2, 8)}`,
      keepalive: 60,
      protocolVersion: 5, // MQTT 5.0 for better features
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 30 * 1000,
    });

    this.client.on('connect', () => {
      console.log('[Net] MQTT Connected via Secure WebSockets');
      this.subscribeToChannels();
    });

    this.client.on('message', (topic, message) => {
      try {
        const parsedMsg = JSON.parse(message.toString()) as NetworkMessage;
        this.notifyListeners(parsedMsg);
      } catch (e) {
        console.error('[Net] Failed to parse message', e);
      }
    });

    this.client.on('error', (err) => {
      console.error('[Net] MQTT Error:', err);
    });
    
    this.client.on('reconnect', () => {
      console.log('[Net] Reconnecting...');
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    this.pin = null;
    this.role = null;
    console.log('[Net] Disconnected');
  }

  isConnected(): boolean {
    return !!this.client && this.client.connected;
  }

  subscribe(callback: (msg: NetworkMessage) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(msg: NetworkMessage) {
    this.listeners.forEach((listener) => listener(msg));
  }

  private subscribeToChannels() {
    if (!this.client || !this.pin || !this.role) return;

    // Host listens to CLIENT actions
    // Player listens to HOST updates
    const topicToSubscribe = this.role === 'HOST' 
      ? `genquiz/v2/${this.pin}/client` 
      : `genquiz/v2/${this.pin}/host`;

    console.log(`[Net] Subscribing to: ${topicToSubscribe}`);
    
    this.client.subscribe(topicToSubscribe, { qos: 1 }, (err) => {
      if (err) console.error('[Net] Subscription error:', err);
      else console.log('[Net] Subscribed successfully');
    });
  }

  /**
   * @param type Message type
   * @param payload Data
   * @param retain If true, the broker stores this message. New subscribers get it immediately.
   */
  send(type: MessageType, payload: any, retain: boolean = false) {
    if (!this.client || !this.pin || !this.role) {
      console.warn('[Net] Cannot send: Client not connected');
      return;
    }

    const msg: NetworkMessage = { type, pin: this.pin, payload };
    
    const topicToPublish = this.role === 'HOST' 
      ? `genquiz/v2/${this.pin}/host` 
      : `genquiz/v2/${this.pin}/client`;

    // console.log(`[Net] Publishing to ${topicToPublish} (Retain: ${retain})`, msg.type);
    
    this.client.publish(topicToPublish, JSON.stringify(msg), { qos: 1, retain });
  }
}

export const network = new NetworkService();
