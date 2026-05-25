ALTER TABLE game_state
  ADD COLUMN player_can_move_token BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN player_can_reveal_fog BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN player_can_edit_token BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN player_can_edit_hp    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN player_can_edit_sheet BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN players_see_dm_rolls  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN player_can_roll_dice  BOOLEAN NOT NULL DEFAULT true;
