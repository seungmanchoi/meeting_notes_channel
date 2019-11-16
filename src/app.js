import timeUuid from 'time-uuid';
import express from 'express';
import http from 'http';
import socketIO from 'socket.io';
import moment from 'moment';
import dotenv from 'dotenv';
import _ from 'lodash';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const channelMap = new Map();
const sockets = [];

/**
 * channelCreator: user.id,
 * channelName,
 * userCount: 1,
 * channelUserLimitCount,
 * createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
 * users: [socket.id],
 * */
const channelInfo = new Map();
const {
  WEB_SERVER_HOST = process.env.WEB_SERVER_HOST,
  SERVER_PORT = process.env.SERVER_PORT,
} = dotenv.config().parsed;

app.use(cors());

/**
 * 채널 생성자는 header에 유효한 토큰이 존재해야 한다.
 * 채널 생성시 토큰을 통해 api로 사용자의 채널 인원제한수를 체크
 * */
io.on('connection', (socket) => {
  const socketInfo = {
    id: socket.id,
    socket,
  };

  sockets.push(socketInfo);
  /**
   * 채널 생성
   * @param {object} data
   * - channelName
   * */
  // socket.on('create-channel', ({
  //   channelName,
  // }) => {
  //   console.log(`create-channel - channelName : ${channelName} id : ${id}`);
  //
  //   const uuid = timeUuid();
  //   const info = {
  //     channelCreator: socket.id,
  //     channelName,
  //     userCount: 1,
  //     channelUserLimitCount: 10,
  //     createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
  //     users: [socket.id],
  //   };
  //
  //   channelMap.set(channelName, uuid);
  //   channelInfo.set(uuid, info);
  //
  //   socket.join(uuid);
  //   socket.emit('join-channel', { ...info, joinUser: { name, socketId: socket.id } });
  //   socket.channelName = channelName;
  // });

  // data { channelName, id, from, to }
  socket.on('layout-channel', (data) => {
    const channelId = channelMap.get(data.channelName);

    socket.nsp.to(channelId).emit('layout-channel', data);
  });

  // 채널 종료
  socket.on('destroy-channel', ({ channelName }) => {
    console.log(`destroy-channel - channelName : ${channelName}`);

    if (channelMap.has(channelName)) {
      const channelId = channelMap.get(channelName);
      const info = channelInfo.get(channelId);

      if (socket.id === info.channelCreator) {
        channelMap.delete(channelName);
        channelInfo.delete(channelId);

        info.users.forEach((socketId) => {
          const index = _.findIndex(sockets, { id: socketId });
          const s = sockets.splice(index, 1)[0].socket;
          delete s.channelName;

          s.leave(channelId);
          s.emit('destroy-channel', { ...info, userCount: 0, users: [] });
        });
      } else {
        socket.emit('destroy-channel', { error: 'NO_AUTHORIZATION' });
      }
    } else {
      socket.emit('destroy-channel', { error: 'CHANNEL_NOT_FOUND' });
    }
  });

  // 채널 접속 ( 채널 생성자 이외의 사람이 접속 )
  socket.on('join-channel', ({ channelName, name }) => {
    console.log(`join-channel - channelName : ${channelName} socket.id : ${socket.id}`);

    const joinedAt = moment().format('YYYY-MM-DD HH:MM:ss');

    if (channelMap.has(channelName)) {
      const channelId = channelMap.get(channelName);
      const info = channelInfo.get(channelId);

      const { users } = channelInfo.get(channelId);
      const userCount = info.userCount + 1;

      socket.channelName = channelName;

      users.push(socket.id);
      info.roomUsers.push({
        id: socket.id,
        name,
        avatar: `${WEB_SERVER_HOST}/images/avatars/avatar${info.userCount + 1}.png`,
        joinedAt,
      });

      channelInfo.set(channelId, { ...info, users, userCount });

      socket.join(channelId);
      // socket.emit('joined-channel', { ...info, userCount });
      socket.nsp.to(channelId).emit('join-channel', {
        ...info,
        userCount,
        joinUser: {
          name,
          id: socket.id,
          avatar: `${WEB_SERVER_HOST}/images/avatars/avatar${info.userCount + 1}.png`,
          joinedAt,
        },
      });
    } else {
      console.log(`create-channel - channelName : ${channelName} id : ${name}`);

      const uuid = timeUuid();
      const info = {
        channelCreator: socket.id,
        channelName,
        userCount: 1,
        channelUserLimitCount: 10,
        createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        users: [socket.id],
        roomUsers: [{
          id: socket.id,
          name,
          avatar: `${WEB_SERVER_HOST}/images/avatars/avatar1.png`,
          joinedAt,
        }],
      };

      channelMap.set(channelName, uuid);
      channelInfo.set(uuid, info);

      socket.join(uuid);
      socket.emit('join-channel', {
        ...info,
        joinUser: {
          name,
          id: socket.id,
          joinedAt,
          avatar: `${WEB_SERVER_HOST}/images/avatars/avatar1.png`,
        },
      });
      socket.channelName = channelName;
    }
  });

  // 채널 해제 ( 채널 생성자 이외의 사람이 해제 )
  socket.on('leave-channel', ({ channelName, id }) => {
    console.log(`leave-channel - channelName : ${channelName}`);

    if (channelMap.has(channelName)) {
      const uId = socket.id;
      const channelId = channelMap.get(channelName);
      const info = channelInfo.get(channelId);
      const userCount = info.userCount - 1;

      channelInfo.get(channelId).userCount = userCount;
      _.pull(channelInfo.get(channelId).users, uId);

      if (userCount === 0) {
        channelMap.delete(channelName);
        channelInfo.delete(channelId);
      }

      socket.leave(channelId);
      socket.nsp.to(channelId).emit('leave-channel', { ...info, userCount, leaveUser: id });
    } else {
      socket.emit('leave-channel', { error: 'CHANNEL_NOT_FOUND' });
    }
  });

  socket.on('message-channel', ({
    channelName,
    id,
    command,
    message,
  }) => {
    if (channelMap.has(channelName)) {
      const channelId = channelMap.get(channelName);

      socket.nsp.to(channelId).emit('message-channel', {
        channelName,
        id,
        command,
        message,
        receivedAt: moment().format('HH:MM:ss'),
      });
    } else {
      socket.emit('message-channel', { error: 'CHANNEL_NOT_FOUND' });
    }
  });

  // 접속 종료 TODO:: destroy 내용 필요 socket id로 찾아서 삭제?
  socket.on('disconnect', () => {
    const uId = socket.id;
    const { channelName } = socket;

    if (channelName && channelMap.has(channelName)) {
      const channelId = channelMap.get(channelName);
      const channel = channelInfo.get(channelId);

      if (_.includes(channel.users, uId)) {
        if (socket.id === channel.channelCreator) {
          channelMap.delete(channelName);
          channelInfo.delete(channelId);

          channel.users.forEach((socketId) => {
            const index = _.findIndex(sockets, { id: socketId });

            if (index !== -1) {
              const s = sockets.splice(index, 1)[0].socket;

              s.leave(channelId);
              s.emit('destroy-channel', { ...channel, userCount: 0, users: [] });
            }
          });
        } else {
          channel.users.forEach((socketId) => {
            const index = _.findIndex(sockets, { id: socketId });

            const s = sockets.splice(index, 1)[0].socket;
            s.leave(channelId);

            const users = _.remove(channel.users, (sId) => {
              if (sId !== uId) {
                return true;
              }

              return false;
            });

            socket.nsp.to(channelId).emit('leave-channel', {
              ...channel,
              userCount: channel.userCount - 1,
              users,
              leaveUser: {
                leavedAt: moment().format('HH:mm:ss'),
                id: socket.id,
              },
            });
          });
        }
      }
    }

    const index = _.findIndex(sockets, { id: socket.id });
    sockets.splice(index, 1);
  });
});

server.listen(SERVER_PORT, () => {
  console.log(`Socket IO server listening on port ${SERVER_PORT}`);
});
