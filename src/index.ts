import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import type { WSContext } from 'hono/ws'

const { upgradeWebSocket, websocket } =
  createBunWebSocket<ServerWebSocket>()

const app = new Hono()

// Store active connections in a Map
const rooms = new Map<string, Set<ServerWebSocket>>()

// app.get('/', (c) => {
//   return c.text('Hello Hono!')
// })

app.get('/', (c) => {
  return c.html(`
    <html>
      <body>
        <div id='now-time'></div>
        <input type='text' id='message-input' placeholder='Type a message...'>
        <button id='send-button'>Send</button>
        <script>
          const roomId = '1'; // Connect to room 1
          const ws = new WebSocket('ws://localhost:3000/ws?room=' + roomId)
          const $nowTime = document.getElementById('now-time')
          
          ws.onmessage = (event) => {
            $nowTime.textContent = event.data
          }
          
          ws.onopen = () => {
            $nowTime.textContent = 'Connected to room ' + roomId
          }
          
          ws.onclose = () => {
            $nowTime.textContent = 'Disconnected from room ' + roomId
          }

          const sendButton = document.getElementById('send-button')
          sendButton.addEventListener('click', () => {
            const messageInput = document.getElementById('message-input')
            const message = messageInput.value
            ws.send(message)
            messageInput.value = ''
          })
        </script>
      </body>
    </html>
    `)
})

app.get(
  '/ws',
  upgradeWebSocket((c) => {
    const roomId = c.req.query('room') || '1' // Default to room 1 if not specified
    
    return {
      onOpen(evt: Event, ws: WSContext<ServerWebSocket>) {
        // Add connection to room
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        const roomSet = rooms.get(roomId)
        if (roomSet && ws.raw) {
          roomSet.add(ws.raw)
        }
        console.log(`Client connected to room ${roomId}`)
      },
      
      onMessage(evt: MessageEvent, ws: WSContext<ServerWebSocket>) {
        const message = evt.data as string
        console.log(`Message from client in room ${roomId}: ${message}`)
        
        // Broadcast message to all clients in the same room
        const roomConnections = rooms.get(roomId)
        if (roomConnections && ws.raw) {
          roomConnections.forEach((client: ServerWebSocket) => {
            if (client !== ws.raw) { // Don't send back to sender
              client.sendText(message)
            }
          })
        }
      },
      
      onClose(evt: CloseEvent, ws: WSContext<ServerWebSocket>) {
        // Remove connection from room
        const roomConnections = rooms.get(roomId)
        if (roomConnections && ws.raw) {
          roomConnections.delete(ws.raw)
          if (roomConnections.size === 0) {
            rooms.delete(roomId)
          }
        }
        console.log(`Client disconnected from room ${roomId}`)
      },
    }
  })
)

export default {
  fetch: app.fetch,
  websocket,
}