from channels.generic.websocket import AsyncWebsocketConsumer
import json


class TaskConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for task progress updates.

    Clients should connect to: ws://<host>/ws/tasks/<task_id>/
    The consumer will add the connection to group `task_<task_id>` and
    forward `task.message` events to the client as JSON:
      {"type": "task.message", "status": "started|progress|finished|failed", "payload": {...}}
    """

    async def connect(self):
        self.task_id = self.scope['url_route']['kwargs'].get('task_id')
        self.group_name = f"task_{self.task_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def task_message(self, event):
        # event expected to contain 'status' and 'payload'
        await self.send(json.dumps({
            'type': 'task.message',
            'status': event.get('status', 'update'),
            'payload': event.get('payload', {}),
        }))
