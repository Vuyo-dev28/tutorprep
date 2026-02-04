create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  grade int check (grade >= 8 and grade <= 12), -- Exact grade match only (8-12), no ranges allowed
  school_name text,
  curriculum text not null default 'CAPS' check (curriculum in ('CAPS', 'IEB')),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Admin policies for content management
create policy "Admins can manage subjects"
  on public.subjects
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage topics"
  on public.topics
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage lessons"
  on public.lessons
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage questions"
  on public.questions
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage achievements"
  on public.achievements
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can view all user data"
  on public.user_topic_progress
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can view all quiz attempts"
  on public.quiz_attempts
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can view all study sessions"
  on public.study_sessions
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Security definer function to check if user is a student (bypasses RLS)
create or replace function public.is_student()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'student'
  );
end;
$$;

-- Leaderboard policies: Allow students to view other students' data for leaderboard
create policy "Students can view profiles for leaderboard"
  on public.profiles
  for select
  using (
    auth.uid() is not null and
    public.is_student()
  );

create policy "Students can view study sessions for leaderboard"
  on public.study_sessions
  for select
  using (
    auth.uid() is not null and
    public.is_student()
  );

create policy "Students can view topic progress for leaderboard"
  on public.user_topic_progress
  for select
  using (
    auth.uid() is not null and
    public.is_student()
  );

create policy "Students can view quiz attempts for leaderboard"
  on public.quiz_attempts
  for select
  using (
    auth.uid() is not null and
    public.is_student()
  );

create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  difficulty text not null check (difficulty slug ('beginner', 'intermediate', 'advanced')),
  grade int not null check (grade >= 8 and grade <= 12), -- Exact grade match only (8-12), no ranges allowed, NOT NULL required
  curriculum text not null default 'CAPS' check (curriculum in ('CAPS', 'IEB')),
  is_assessment boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.lessons (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  type text not null check (type in ('video', 'notes', 'example')),
  duration text,
  content text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_answer int not null,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_topic_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  progress int not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table if not exists public.user_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked boolean not null default false,
  unlocked_at timestamptz,
  primary key (user_id, achievement_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  score int not null,
  total_questions int not null,
  percentage int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  struggling_topics jsonb not null,
  needs_work jsonb not null,
  recommendations text,
  overall_performance text,
  created_at timestamptz not null default now(),
  unique (user_id, report_date)
);

alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_topic_progress enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.user_achievements enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.study_sessions enable row level security;

create policy "Subjects are readable"
  on public.subjects
  for select
  using (true);

-- Curriculum gating: Students only see content matching their profile curriculum
create policy "Topics are readable by curriculum"
  on public.topics
  for select
  using (
    auth.uid() is not null
    and curriculum = (
      select p.curriculum from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "Lessons are readable by curriculum"
  on public.lessons
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.topics t
      join public.profiles p on p.id = auth.uid()
      where t.id = lessons.topic_id
        and t.curriculum = p.curriculum
    )
  );

create policy "Questions are readable by curriculum"
  on public.questions
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.topics t
      join public.profiles p on p.id = auth.uid()
      where t.id = questions.topic_id
        and t.curriculum = p.curriculum
    )
  );

create policy "Achievements are readable"
  on public.achievements
  for select
  using (true);

create policy "User topic progress is viewable by owner"
  on public.user_topic_progress
  for select
  using (auth.uid() = user_id);

create policy "User topic progress is insertable by owner"
  on public.user_topic_progress
  for insert
  with check (auth.uid() = user_id);

create policy "User topic progress is updatable by owner"
  on public.user_topic_progress
  for update
  using (auth.uid() = user_id);

create policy "User lesson progress is viewable by owner"
  on public.user_lesson_progress
  for select
  using (auth.uid() = user_id);

create policy "User lesson progress is insertable by owner"
  on public.user_lesson_progress
  for insert
  with check (auth.uid() = user_id);

create policy "User lesson progress is updatable by owner"
  on public.user_lesson_progress
  for update
  using (auth.uid() = user_id);

create policy "User achievements are viewable by owner"
  on public.user_achievements
  for select
  using (auth.uid() = user_id);

create policy "User achievements are insertable by owner"
  on public.user_achievements
  for insert
  with check (auth.uid() = user_id);

create policy "User achievements are updatable by owner"
  on public.user_achievements
  for update
  using (auth.uid() = user_id);

create policy "Quiz attempts are viewable by owner"
  on public.quiz_attempts
  for select
  using (auth.uid() = user_id);

create policy "Quiz attempts are insertable by owner"
  on public.quiz_attempts
  for insert
  with check (auth.uid() = user_id);

create policy "Study sessions are viewable by owner"
  on public.study_sessions
  for select
  using (auth.uid() = user_id);

create policy "Study sessions are insertable by owner"
  on public.study_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Study sessions are updatable by owner"
  on public.study_sessions
  for update
  using (auth.uid() = user_id);

create policy "Daily reports are viewable by owner"
  on public.daily_reports
  for select
  using (auth.uid() = user_id);

create policy "Daily reports are insertable by owner"
  on public.daily_reports
  for insert
  with check (auth.uid() = user_id);

create policy "Daily reports are viewable by owner"
  on public.daily_reports
  for select
  using (auth.uid() = user_id);

create policy "Daily reports are insertable by owner"
  on public.daily_reports
  for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, grade, school_name, curriculum)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    nullif(new.raw_user_meta_data->>'grade', ''),
    nullif(new.raw_user_meta_data->>'school_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'curriculum', ''), 'CAPS')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    grade = excluded.grade,
    school_name = excluded.school_name,
    curriculum = excluded.curriculum,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Seed data: Insert Mathematics and Physics subjects
insert into public.subjects (slug, name, description, icon, color, sort_order)
values 
  ('maths', 'Mathematics', 'Mathematics - Learn algebra, geometry, calculus, and more', '📐', '#3B82F6', 1),
  ('physics', 'Physics', 'Physics - Explore mechanics, thermodynamics, and quantum physics', '⚛️', '#8B5CF6', 2)
on conflict (slug) do nothing;

-- Seed data: Insert Mathematics Topics
-- Note: Grade is integer (8-12) for exact matching only - no ranges allowed
insert into public.topics (subject_id, slug, name, description, difficulty, grade, sort_order)
select 
  s.id,
  topic_data.slug,
  topic_data.name,
  topic_data.description,
  topic_data.difficulty,
  topic_data.grade, -- Integer grade (8-12) for exact matching
  topic_data.sort_order
from public.subjects s
cross join (values
  -- Algebra (Grades 8-12)
  ('ratios-proportions', 'Ratios and Proportions', 'Understanding ratios, proportions, and their applications', 'intermediate', 8, 7),
  ('algebra-basics', 'Algebra Basics', 'Introduction to variables, expressions, and basic algebraic concepts', 'beginner', 8, 8),
  ('linear-equations', 'Linear Equations', 'Solving one-step and two-step linear equations', 'intermediate', 8, 9),
  ('linear-equations', 'Linear Equations', 'Solving one-step and two-step linear equations', 'intermediate', 9, 9),
  ('systems-equations', 'Systems of Equations', 'Solving systems of linear equations using various methods', 'intermediate', 9, 10),
  ('systems-equations', 'Systems of Equations', 'Solving systems of linear equations using various methods', 'intermediate', 10, 10),
  ('quadratic-equations', 'Quadratic Equations', 'Solving quadratic equations by factoring, completing the square, and quadratic formula', 'advanced', 10, 11),
  ('quadratic-equations', 'Quadratic Equations', 'Solving quadratic equations by factoring, completing the square, and quadratic formula', 'advanced', 11, 11),
  ('polynomials', 'Polynomials', 'Operations with polynomials, factoring, and polynomial equations', 'advanced', 10, 12),
  ('polynomials', 'Polynomials', 'Operations with polynomials, factoring, and polynomial equations', 'advanced', 11, 12),
  ('functions', 'Functions', 'Understanding functions, domain, range, and function transformations', 'intermediate', 9, 13),
  ('functions', 'Functions', 'Understanding functions, domain, range, and function transformations', 'intermediate', 10, 13),
  ('functions', 'Functions', 'Understanding functions, domain, range, and function transformations', 'intermediate', 11, 13),
  ('exponential-logarithmic', 'Exponential and Logarithmic Functions', 'Working with exponential and logarithmic functions', 'advanced', 11, 14),
  ('exponential-logarithmic', 'Exponential and Logarithmic Functions', 'Working with exponential and logarithmic functions', 'advanced', 12, 14),
  
  -- Geometry (Grades 8-12)
  ('volume-surface-area', 'Volume and Surface Area', 'Finding volume and surface area of 3D shapes', 'intermediate', 8, 17),
  ('angles', 'Angles and Lines', 'Understanding angles, parallel lines, and transversals', 'intermediate', 8, 18),
  ('angles', 'Angles and Lines', 'Understanding angles, parallel lines, and transversals', 'intermediate', 9, 18),
  ('triangles', 'Triangles', 'Properties of triangles, Pythagorean theorem, and triangle congruence', 'intermediate', 8, 19),
  ('triangles', 'Triangles', 'Properties of triangles, Pythagorean theorem, and triangle congruence', 'intermediate', 9, 19),
  ('triangles', 'Triangles', 'Properties of triangles, Pythagorean theorem, and triangle congruence', 'intermediate', 10, 19),
  ('circles', 'Circles', 'Properties of circles, circumference, and area of circles', 'intermediate', 8, 20),
  ('circles', 'Circles', 'Properties of circles, circumference, and area of circles', 'intermediate', 9, 20),
  ('transformations', 'Geometric Transformations', 'Translations, rotations, reflections, and dilations', 'intermediate', 8, 21),
  ('transformations', 'Geometric Transformations', 'Translations, rotations, reflections, and dilations', 'intermediate', 9, 21),
  ('transformations', 'Geometric Transformations', 'Translations, rotations, reflections, and dilations', 'intermediate', 10, 21),
  ('coordinate-geometry', 'Coordinate Geometry', 'Working with coordinate planes, distance formula, and slope', 'intermediate', 9, 22),
  ('coordinate-geometry', 'Coordinate Geometry', 'Working with coordinate planes, distance formula, and slope', 'intermediate', 10, 22),
  ('coordinate-geometry', 'Coordinate Geometry', 'Working with coordinate planes, distance formula, and slope', 'intermediate', 11, 22),
  
  -- Trigonometry (Grades 10-12)
  ('trigonometry-basics', 'Trigonometry Basics', 'Introduction to sine, cosine, and tangent', 'intermediate', 10, 23),
  ('trigonometry-basics', 'Trigonometry Basics', 'Introduction to sine, cosine, and tangent', 'intermediate', 11, 23),
  ('trigonometry-basics', 'Trigonometry Basics', 'Introduction to sine, cosine, and tangent', 'intermediate', 12, 23),
  ('trigonometric-functions', 'Trigonometric Functions', 'Graphing and analyzing trigonometric functions', 'advanced', 11, 24),
  ('trigonometric-functions', 'Trigonometric Functions', 'Graphing and analyzing trigonometric functions', 'advanced', 12, 24),
  ('trigonometric-identities', 'Trigonometric Identities', 'Proving and using trigonometric identities', 'advanced', 12, 25),
  
  -- Statistics and Probability (Grades 8-12)
  ('statistics', 'Statistics', 'Mean, median, mode, range, and standard deviation', 'intermediate', 8, 27),
  ('statistics', 'Statistics', 'Mean, median, mode, range, and standard deviation', 'intermediate', 9, 27),
  ('statistics', 'Statistics', 'Mean, median, mode, range, and standard deviation', 'intermediate', 10, 27),
  ('probability', 'Probability', 'Understanding probability, events, and probability calculations', 'intermediate', 8, 28),
  ('probability', 'Probability', 'Understanding probability, events, and probability calculations', 'intermediate', 9, 28),
  ('probability', 'Probability', 'Understanding probability, events, and probability calculations', 'intermediate', 10, 28),
  ('probability', 'Probability', 'Understanding probability, events, and probability calculations', 'intermediate', 11, 28),
  ('probability', 'Probability', 'Understanding probability, events, and probability calculations', 'intermediate', 12, 28),
  
  -- Calculus (Grade 12 only)
  ('limits', 'Limits', 'Understanding limits and continuity', 'advanced', 12, 29),
  ('derivatives', 'Derivatives', 'Finding derivatives and their applications', 'advanced', 12, 30),
  ('integrals', 'Integrals', 'Integration techniques and applications', 'advanced', 12, 31),
  
  -- Other Topics (Grades 8-12)
  ('word-problems', 'Word Problems', 'Solving real-world problems using mathematical concepts', 'intermediate', 8, 34),
  ('word-problems', 'Word Problems', 'Solving real-world problems using mathematical concepts', 'intermediate', 9, 34),
  ('word-problems', 'Word Problems', 'Solving real-world problems using mathematical concepts', 'intermediate', 10, 34),
  ('sequences-series', 'Sequences and Series', 'Arithmetic and geometric sequences and series', 'advanced', 11, 35),
  ('sequences-series', 'Sequences and Series', 'Arithmetic and geometric sequences and series', 'advanced', 12, 35)
) as topic_data(slug, name, description, difficulty, grade, sort_order)
where s.slug = 'maths'
on conflict (subject_id, slug) do nothing;

-- Seed data: Insert Physics Topics
insert into public.topics (subject_id, slug, name, description, difficulty, grade, sort_order)
select 
  s.id,
  topic_data.slug,
  topic_data.name,
  topic_data.description,
  topic_data.difficulty,
  topic_data.grade,
  topic_data.sort_order
from public.subjects s
cross join (values
  -- Mechanics (Grades 9-12)
  ('motion-basics', 'Motion Basics', 'Understanding position, distance, displacement, and basic motion concepts', 'beginner', 9, 1),
  ('motion-basics', 'Motion Basics', 'Understanding position, distance, displacement, and basic motion concepts', 'beginner', 10, 1),
  ('kinematics', 'Kinematics', 'Velocity, acceleration, and equations of motion', 'intermediate', 10, 2),
  ('kinematics', 'Kinematics', 'Velocity, acceleration, and equations of motion', 'intermediate', 11, 2),
  ('forces', 'Forces', 'Understanding forces, Newton''s laws, and force diagrams', 'intermediate', 10, 3),
  ('forces', 'Forces', 'Understanding forces, Newton''s laws, and force diagrams', 'intermediate', 11, 3),
  ('newtons-laws', 'Newton''s Laws of Motion', 'Applying Newton''s three laws to solve problems', 'intermediate', 10, 4),
  ('newtons-laws', 'Newton''s Laws of Motion', 'Applying Newton''s three laws to solve problems', 'intermediate', 11, 4),
  ('friction', 'Friction', 'Types of friction and friction problems', 'intermediate', 10, 5),
  ('friction', 'Friction', 'Types of friction and friction problems', 'intermediate', 11, 5),
  ('energy', 'Energy', 'Kinetic energy, potential energy, and conservation of energy', 'intermediate', 10, 6),
  ('energy', 'Energy', 'Kinetic energy, potential energy, and conservation of energy', 'intermediate', 11, 6),
  ('work-power', 'Work and Power', 'Calculating work done and power', 'intermediate', 10, 7),
  ('work-power', 'Work and Power', 'Calculating work done and power', 'intermediate', 11, 7),
  ('momentum', 'Momentum', 'Linear momentum, impulse, and conservation of momentum', 'advanced', 11, 8),
  ('momentum', 'Momentum', 'Linear momentum, impulse, and conservation of momentum', 'advanced', 12, 8),
  ('circular-motion', 'Circular Motion', 'Uniform circular motion and centripetal force', 'advanced', 11, 9),
  ('circular-motion', 'Circular Motion', 'Uniform circular motion and centripetal force', 'advanced', 12, 9),
  ('gravity', 'Gravity', 'Gravitational force, weight, and free fall', 'intermediate', 10, 10),
  ('gravity', 'Gravity', 'Gravitational force, weight, and free fall', 'intermediate', 11, 10),
  ('projectile-motion', 'Projectile Motion', 'Motion of objects in two dimensions', 'advanced', 11, 11),
  ('projectile-motion', 'Projectile Motion', 'Motion of objects in two dimensions', 'advanced', 12, 11),
  
  -- Thermodynamics (Grades 9-12)
  ('temperature-heat', 'Temperature and Heat', 'Understanding temperature, heat, and thermal energy', 'beginner', 9, 12),
  ('temperature-heat', 'Temperature and Heat', 'Understanding temperature, heat, and thermal energy', 'beginner', 10, 12),
  ('thermal-expansion', 'Thermal Expansion', 'How materials expand when heated', 'intermediate', 10, 13),
  ('thermal-expansion', 'Thermal Expansion', 'How materials expand when heated', 'intermediate', 11, 13),
  ('heat-transfer', 'Heat Transfer', 'Conduction, convection, and radiation', 'intermediate', 10, 14),
  ('heat-transfer', 'Heat Transfer', 'Conduction, convection, and radiation', 'intermediate', 11, 14),
  ('thermodynamics-laws', 'Laws of Thermodynamics', 'First and second laws of thermodynamics', 'advanced', 11, 15),
  ('thermodynamics-laws', 'Laws of Thermodynamics', 'First and second laws of thermodynamics', 'advanced', 12, 15),
  ('ideal-gases', 'Ideal Gases', 'Gas laws and kinetic theory of gases', 'advanced', 11, 16),
  ('ideal-gases', 'Ideal Gases', 'Gas laws and kinetic theory of gases', 'advanced', 12, 16),
  
  -- Waves and Optics (Grades 9-12)
  ('waves-basics', 'Waves Basics', 'Introduction to waves, wavelength, frequency, and amplitude', 'beginner', 9, 17),
  ('waves-basics', 'Waves Basics', 'Introduction to waves, wavelength, frequency, and amplitude', 'beginner', 10, 17),
  ('sound-waves', 'Sound Waves', 'Properties of sound, pitch, and resonance', 'intermediate', 10, 18),
  ('sound-waves', 'Sound Waves', 'Properties of sound, pitch, and resonance', 'intermediate', 11, 18),
  ('light-optics', 'Light and Optics', 'Reflection, refraction, and lenses', 'intermediate', 10, 19),
  ('light-optics', 'Light and Optics', 'Reflection, refraction, and lenses', 'intermediate', 11, 19),
  ('wave-interference', 'Wave Interference', 'Constructive and destructive interference', 'advanced', 11, 20),
  ('wave-interference', 'Wave Interference', 'Constructive and destructive interference', 'advanced', 12, 20),
  ('electromagnetic-spectrum', 'Electromagnetic Spectrum', 'Types of electromagnetic waves and their properties', 'intermediate', 10, 21),
  ('electromagnetic-spectrum', 'Electromagnetic Spectrum', 'Types of electromagnetic waves and their properties', 'intermediate', 11, 21),
  
  -- Electricity and Magnetism (Grades 9-12)
  ('electric-charge', 'Electric Charge', 'Static electricity and electric charge', 'beginner', 9, 22),
  ('electric-charge', 'Electric Charge', 'Static electricity and electric charge', 'beginner', 10, 22),
  ('electric-current', 'Electric Current', 'Understanding current, voltage, and resistance', 'intermediate', 10, 23),
  ('electric-current', 'Electric Current', 'Understanding current, voltage, and resistance', 'intermediate', 11, 23),
  ('circuits', 'Electric Circuits', 'Series and parallel circuits, Ohm''s law', 'intermediate', 10, 24),
  ('circuits', 'Electric Circuits', 'Series and parallel circuits, Ohm''s law', 'intermediate', 11, 24),
  ('magnetism', 'Magnetism', 'Magnetic fields, poles, and magnetic forces', 'intermediate', 10, 25),
  ('magnetism', 'Magnetism', 'Magnetic fields, poles, and magnetic forces', 'intermediate', 11, 25),
  ('electromagnetism', 'Electromagnetism', 'Relationship between electricity and magnetism', 'advanced', 11, 26),
  ('electromagnetism', 'Electromagnetism', 'Relationship between electricity and magnetism', 'advanced', 12, 26),
  ('capacitors-inductors', 'Capacitors and Inductors', 'Energy storage in electric and magnetic fields', 'advanced', 12, 27),
  
  -- Modern Physics (Grades 10-12)
  ('atomic-structure', 'Atomic Structure', 'Structure of atoms, electrons, protons, and neutrons', 'intermediate', 10, 28),
  ('atomic-structure', 'Atomic Structure', 'Structure of atoms, electrons, protons, and neutrons', 'intermediate', 11, 28),
  ('nuclear-physics', 'Nuclear Physics', 'Radioactivity, nuclear reactions, and nuclear energy', 'advanced', 11, 29),
  ('nuclear-physics', 'Nuclear Physics', 'Radioactivity, nuclear reactions, and nuclear energy', 'advanced', 12, 29),
  ('quantum-physics', 'Quantum Physics', 'Introduction to quantum mechanics and wave-particle duality', 'advanced', 12, 30),
  ('relativity', 'Relativity', 'Special and general relativity concepts', 'advanced', 12, 31),
  
  -- Other Topics (Grades 9-12)
  ('measurement-uncertainty', 'Measurement and Uncertainty', 'Precision, accuracy, and error analysis', 'beginner', 9, 32),
  ('measurement-uncertainty', 'Measurement and Uncertainty', 'Precision, accuracy, and error analysis', 'beginner', 10, 32),
  ('vectors', 'Vectors', 'Vector addition, subtraction, and components', 'intermediate', 10, 33),
  ('vectors', 'Vectors', 'Vector addition, subtraction, and components', 'intermediate', 11, 33),
  ('simple-machines', 'Simple Machines', 'Levers, pulleys, inclined planes, and mechanical advantage', 'beginner', 9, 34),
  ('simple-machines', 'Simple Machines', 'Levers, pulleys, inclined planes, and mechanical advantage', 'beginner', 10, 34),
  ('fluids', 'Fluids', 'Pressure, buoyancy, and fluid dynamics', 'advanced', 11, 35),
  ('fluids', 'Fluids', 'Pressure, buoyancy, and fluid dynamics', 'advanced', 12, 35),
  ('oscillations', 'Oscillations', 'Simple harmonic motion and pendulums', 'advanced', 11, 36),
  ('oscillations', 'Oscillations', 'Simple harmonic motion and pendulums', 'advanced', 12, 36)
) as topic_data(slug, name, description, difficulty, grade, sort_order)
where s.slug = 'physics'
on conflict (subject_id, slug) do nothing;
