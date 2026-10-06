import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  Clock,
  Droplet,
  Flag,
  Flame,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  HeartPulse,
  Leaf,
  Lightbulb,
  Mail,
  MapPin,
  Medal,
  Megaphone,
  Mic,
  Moon,
  Music,
  Phone,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
} from 'lucide-react';
import { ICON_NAMES, normalizeIconName } from '../../../shared/templateElements.js';

/* ------------------------------------------------------------------ *
 * The only pictures this app can draw.
 *
 * Every name in ICON_NAMES (the list the shared rules offer an admin) has its own
 * import here, so the bundle carries exactly those and nothing else - no wildcard
 * import of the whole icon set. A name that is not in the map falls back to the
 * shared fallback picture, so a poster never shows a hole.
 * ------------------------------------------------------------------ */

const ICONS = {
  'activity': Activity,
  'award': Award,
  'bell': Bell,
  'book-open': BookOpen,
  'brain': Brain,
  'briefcase': Briefcase,
  'calendar': Calendar,
  'clock': Clock,
  'droplet': Droplet,
  'flag': Flag,
  'flame': Flame,
  'gift': Gift,
  'globe': Globe,
  'graduation-cap': GraduationCap,
  'heart': Heart,
  'heart-pulse': HeartPulse,
  'leaf': Leaf,
  'lightbulb': Lightbulb,
  'mail': Mail,
  'map-pin': MapPin,
  'medal': Medal,
  'megaphone': Megaphone,
  'mic': Mic,
  'moon': Moon,
  'music': Music,
  'phone': Phone,
  'rocket': Rocket,
  'shield': Shield,
  'sparkles': Sparkles,
  'star': Star,
  'sun': Sun,
  'trophy': Trophy,
  'users': Users,
};

const FALLBACK_ICON = Star;

/** The picture to draw for a name, or nothing when no picture was chosen. */
export function posterIconComponent(name) {
  const key = normalizeIconName(name);
  if (!key) return null;
  return ICONS[key] || FALLBACK_ICON;
}

/** Whether a name is one this app can draw. */
export function isPosterIconName(name) {
  return ICON_NAMES.includes(normalizeIconName(name));
}
