import {TransformStream} from './transformstream.js';

class JSONTransformer {
  constructor() {
    this.chunks = [];
    this.depth = 0;
    this.inString = false;
    this.skipNext = false;
    this.decoder = new TextDecoder();
  }

  start() {}
  flush() {}
  transform(chunk, controller) {
    for(let i = 0; i < chunk.length; i++) {
      if(this.skipNext) {
        this.skipNext = false;
        continue;
      }
      const byte = chunk[i];
      const char = String.fromCharCode(byte);
      switch(char) {
        case '{':
          if(this.inString) continue;
          this.depth++;
        break;
        case '}':
         if(this.inString) continue;
          this.depth--;
          if(this.depth === 0) {
            const tail = new Uint8Array(chunk.buffer, chunk.byteOffset, i + 1);
            chunk = new Uint8Array(chunk.buffer, chunk.byteOffset + i + 1);
            this.chunks.push(tail);

            const jsonStr = this.chunks.reduce((str, chunk) =>
              str + this.decoder.decode(chunk, {stream: true}), '');
            controller.enqueue(jsonStr);

            this.chunks.length = 0;
            i = -1;
          }
        break;
        case '"':
          this.inString = !this.inString;
        break;
        case '\\':
          this.skipNext = true;
        break;
      }
    }
    this.chunks.push(chunk);
  }
}

fetch('/huge.json')
  .then(async resp => {
    const jsonStream = resp.body.pipeThrough(new TransformStream(new JSONTransformer()));
    const reader = jsonStream.getReader();
    while (true) {
      const {value, done} = await reader.read();
      if (done) return;
      console.log(value);
      
    }
  })