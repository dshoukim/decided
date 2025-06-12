-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_movie_elo ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_history ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Users can view rooms they own or participate in" ON rooms
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM room_participants 
      WHERE room_participants.room_id = rooms.id 
      AND room_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own rooms" ON rooms
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Room owners can update their rooms" ON rooms
  FOR UPDATE USING (owner_id = auth.uid());

-- Room participants policies
CREATE POLICY "Users can view participants in their rooms" ON room_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    room_id IN (
      SELECT id FROM rooms WHERE owner_id = auth.uid()
    ) OR
    room_id IN (
      SELECT room_id FROM room_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join rooms" ON room_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation" ON room_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Bracket picks policies
CREATE POLICY "Users can view picks in their rooms" ON bracket_picks
  FOR SELECT USING (
    user_id = auth.uid() OR
    room_id IN (
      SELECT room_id FROM room_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own picks" ON bracket_picks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ELO policies
CREATE POLICY "Users can view their own ELO ratings" ON user_movie_elo
  FOR SELECT USING (user_id = auth.uid());

-- Allow service role to manage all ELO ratings
CREATE POLICY "Service role can manage all ELO ratings" ON user_movie_elo
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Room history policies
CREATE POLICY "Users can view history for their rooms" ON room_history
  FOR SELECT USING (
    room_id IN (
      SELECT id FROM rooms WHERE owner_id = auth.uid()
    ) OR
    room_id IN (
      SELECT room_id FROM room_participants WHERE user_id = auth.uid()
    )
  );

-- Allow service role to insert history
CREATE POLICY "Service role can insert history" ON room_history
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role'); 