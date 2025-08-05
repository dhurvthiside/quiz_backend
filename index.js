const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const allQuestions = require('./questions');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store per-room data
const roomData = {};

// 🔀 Utility to get 20 random questions
const getRandomQuestions = (count = 20) => {
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map((q) => ({
    id: q.id, // Use actual unique question ID
    question: q.question,
    options: q.options,
    answer: q.answer, 
  }));
};

io.on('connection', (socket) => {
  console.log(`📡 User connected: ${socket.id}`);

  socket.on('create_room', (roomId) => {
    socket.join(roomId);
    console.log(`🏠 Room created: ${roomId}`);

    if (!roomData[roomId]) {
      const selectedQuestions = getRandomQuestions();
      roomData[roomId] = {
        questions: selectedQuestions,
        submissions: [],
      };
    }
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`👥 User joined room: ${roomId}`);
    io.to(roomId).emit('room_ready');
  });

  // 🧠 Send selected questions to clients
  socket.on('get_questions', ({ roomId }) => {
    const room = roomData[roomId];
    if (room && room.questions) {
      const questionsForClient = room.questions.map(({ id, question, options }) => ({
        id,
        question,
        options,
      }));
      socket.emit('questions', questionsForClient);
    } else {
      socket.emit('questions', []);
    }
  });

  // ✅ Handle quiz submission and evaluate
  socket.on('submit_quiz', ({ roomId, name, answers, time }) => {
    const room = roomData[roomId];
    if (!room) return;

    console.log(`📝 Answers received from ${name} in room ${roomId}`);

    // Prevent duplicate submission
    if (room.submissions.find((entry) => entry.name === name)) return;

    // ✅ Fixed scoring logic
    let score = 0;
    room.questions.forEach((q) => {
      const userAnswer = answers[q.id];
      const correct = q.answer;
      if (userAnswer && userAnswer === correct) {
        score++;
      }
    });

    room.submissions.push({ name, score, time });

    if (room.submissions.length === 2) {
      const [p1, p2] = room.submissions;

      let winner = 'Draw';
      if (p1.score > p2.score) winner = p1.name;
      else if (p2.score > p1.score) winner = p2.name;
      else winner = p1.time < p2.time ? p1.name : p2.name;

      io.to(roomId).emit('game_result', {
        player1: p1,
        player2: p2,
        winner,
      });

      console.log(`🏁 Game result sent for room ${roomId}`);
      delete roomData[roomId]; // cleanup
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Use dynamic port for Render, fallback to 5000 locally
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
