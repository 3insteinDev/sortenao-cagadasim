
-- Fix linter: restrict SECURITY DEFINER execution + set search_path
ALTER FUNCTION public.tg_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- authenticated needs to call has_role from RLS policies; that runs as the policy executor, not direct API. Keep EXECUTE for authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- =========================================================================
-- GROUPS A..L (12)
-- =========================================================================
INSERT INTO public.groups(letter,name) VALUES
('A','Grupo A'),('B','Grupo B'),('C','Grupo C'),('D','Grupo D'),
('E','Grupo E'),('F','Grupo F'),('G','Grupo G'),('H','Grupo H'),
('I','Grupo I'),('J','Grupo J'),('K','Grupo K'),('L','Grupo L');

-- =========================================================================
-- 48 TEAMS (likely participants / placeholders for 2026)
-- =========================================================================
INSERT INTO public.teams(name,sigla,flag,group_letter) VALUES
-- Grupo A
('México','MEX','🇲🇽','A'),('Canadá','CAN','🇨🇦','A'),('Equador','EQU','🇪🇨','A'),('Egito','EGI','🇪🇬','A'),
-- Grupo B
('Estados Unidos','EUA','🇺🇸','B'),('Croácia','CRO','🇭🇷','B'),('Senegal','SEN','🇸🇳','B'),('Catar','QAT','🇶🇦','B'),
-- Grupo C
('Brasil','BRA','🇧🇷','C'),('Sérvia','SRB','🇷🇸','C'),('Camarões','CMR','🇨🇲','C'),('Suíça','SUI','🇨🇭','C'),
-- Grupo D
('Argentina','ARG','🇦🇷','D'),('Polônia','POL','🇵🇱','D'),('Arábia Saudita','KSA','🇸🇦','D'),('Tunísia','TUN','🇹🇳','D'),
-- Grupo E
('França','FRA','🇫🇷','E'),('Dinamarca','DEN','🇩🇰','E'),('Austrália','AUS','🇦🇺','E'),('Peru','PER','🇵🇪','E'),
-- Grupo F
('Inglaterra','ING','🏴󠁧󠁢󠁥󠁮󠁧󠁿','F'),('Estados Unidos II','USA2','🇺🇸','F'),('País de Gales','WAL','🏴󠁧󠁢󠁷󠁬󠁳󠁿','F'),('Irã','IRN','🇮🇷','F'),
-- Grupo G
('Holanda','NED','🇳🇱','G'),('Equador','EQU2','🇪🇨','G'),('Catar','QAT2','🇶🇦','G'),('Gana','GHA','🇬🇭','G'),
-- Grupo H
('Portugal','POR','🇵🇹','H'),('Uruguai','URU','🇺🇾','H'),('Coreia do Sul','KOR','🇰🇷','H'),('Marrocos','MAR','🇲🇦','H'),
-- Grupo I
('Espanha','ESP','🇪🇸','I'),('Alemanha','ALE','🇩🇪','I'),('Japão','JPN','🇯🇵','I'),('Costa Rica','CRC','🇨🇷','I'),
-- Grupo J
('Bélgica','BEL','🇧🇪','J'),('Colômbia','COL','🇨🇴','J'),('Nigéria','NGA','🇳🇬','J'),('Nova Zelândia','NZL','🇳🇿','J'),
-- Grupo K
('Itália','ITA','🇮🇹','K'),('Chile','CHI','🇨🇱','K'),('Argélia','ALG','🇩🇿','K'),('Costa do Marfim','CIV','🇨🇮','K'),
-- Grupo L
('Países Baixos II','NED2','🇳🇱','L'),('Paraguai','PAR','🇵🇾','L'),('África do Sul','RSA','🇿🇦','L'),('Panamá','PAN','🇵🇦','L');

-- =========================================================================
-- GROUP MATCHES (72)
-- For each group of 4 teams (T1,T2,T3,T4): 6 matches in 3 rounds
-- R1: T1xT2, T3xT4 | R2: T1xT3, T2xT4 | R3: T1xT4, T2xT3
-- =========================================================================
DO $$
DECLARE
  g RECORD; t1 UUID; t2 UUID; t3 UUID; t4 UUID;
  kickoff TIMESTAMPTZ := '2026-06-11 20:00:00+00';
  i INT := 0;
BEGIN
  FOR g IN SELECT letter FROM public.groups ORDER BY letter LOOP
    SELECT id INTO t1 FROM public.teams WHERE group_letter=g.letter ORDER BY created_at LIMIT 1 OFFSET 0;
    SELECT id INTO t2 FROM public.teams WHERE group_letter=g.letter ORDER BY created_at LIMIT 1 OFFSET 1;
    SELECT id INTO t3 FROM public.teams WHERE group_letter=g.letter ORDER BY created_at LIMIT 1 OFFSET 2;
    SELECT id INTO t4 FROM public.teams WHERE group_letter=g.letter ORDER BY created_at LIMIT 1 OFFSET 3;

    INSERT INTO public.matches(phase,group_letter,round,match_code,home_team_id,away_team_id,kickoff_at) VALUES
      ('group',g.letter,1,'G'||g.letter||'-R1-1',t1,t2,kickoff + (i*interval '3 hours')),
      ('group',g.letter,1,'G'||g.letter||'-R1-2',t3,t4,kickoff + ((i+1)*interval '3 hours')),
      ('group',g.letter,2,'G'||g.letter||'-R2-1',t1,t3,kickoff + interval '4 days' + (i*interval '3 hours')),
      ('group',g.letter,2,'G'||g.letter||'-R2-2',t2,t4,kickoff + interval '4 days' + ((i+1)*interval '3 hours')),
      ('group',g.letter,3,'G'||g.letter||'-R3-1',t1,t4,kickoff + interval '8 days' + (i*interval '3 hours')),
      ('group',g.letter,3,'G'||g.letter||'-R3-2',t2,t3,kickoff + interval '8 days' + ((i+1)*interval '3 hours'));
    i := i + 2;
  END LOOP;
END $$;

-- =========================================================================
-- KNOCKOUT MATCHES (placeholders) — R32 (16), R16 (8), QF (4), SF (2), 3º (1), Final (1)
-- =========================================================================
DO $$
DECLARE base TIMESTAMPTZ := '2026-06-27 16:00:00+00';
BEGIN
  -- R32: 16 matches
  FOR i IN 1..16 LOOP
    INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
    VALUES ('r32',1,'R32-'||i,'Classificado '||i,'Classificado '||(32-i+1), base + ((i-1)*interval '6 hours'));
  END LOOP;
  -- R16
  FOR i IN 1..8 LOOP
    INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
    VALUES ('r16',1,'R16-'||i,'Vencedor R32-'||(2*i-1),'Vencedor R32-'||(2*i), base + interval '6 days' + ((i-1)*interval '6 hours'));
  END LOOP;
  -- QF
  FOR i IN 1..4 LOOP
    INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
    VALUES ('qf',1,'QF-'||i,'Vencedor R16-'||(2*i-1),'Vencedor R16-'||(2*i), base + interval '12 days' + ((i-1)*interval '6 hours'));
  END LOOP;
  -- SF
  FOR i IN 1..2 LOOP
    INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
    VALUES ('sf',1,'SF-'||i,'Vencedor QF-'||(2*i-1),'Vencedor QF-'||(2*i), base + interval '17 days' + ((i-1)*interval '24 hours'));
  END LOOP;
  -- 3rd place
  INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
  VALUES ('third',1,'3RD','Perdedor SF-1','Perdedor SF-2', base + interval '22 days');
  -- Final
  INSERT INTO public.matches(phase,round,match_code,home_placeholder,away_placeholder,kickoff_at)
  VALUES ('final',1,'FINAL','Vencedor SF-1','Vencedor SF-2', base + interval '23 days');
END $$;
