const rooms = {};

function createRoom(code, data) {

  rooms[code] = {
    roomCode: code,
    currentSong: null,
    currentTime: 0,
    isPlaying: false,
    ...data
  };

  return rooms[code];

}

function getRoom(code) {
  return rooms[code];
}

function deleteRoom(code) {
  delete rooms[code];
}

function addMember(code, member) {

  if (!rooms[code]) return;

  rooms[code].members.push(member);

}

function removeMember(code, socketId) {

  if (!rooms[code]) return;

  rooms[code].members =
    rooms[code].members.filter(
      m => m.id !== socketId
    );

}

function updatePlayer(code, data) {

  if (!rooms[code]) return;

  rooms[code] = {
    ...rooms[code],
    ...data
  };

}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  deleteRoom,
  addMember,
  removeMember,
  updatePlayer
};