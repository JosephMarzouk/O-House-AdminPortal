import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowsClockwise,
  Buildings,
  CalendarDots,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Clock,
  ClockCountdown,
  Copy,
  DotsThree,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  FilePdf,
  Flag,
  House,
  Info,
  Kanban,
  Key,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Moon,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  Sun,
  Translate,
  Trash,
  User,
  Users,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react/dist/ssr';

/**
 * Phosphor, duotone, and nothing else — the one icon set Broadsheet allows.
 *
 * The `ssr` entry is used because it carries no React context, so the same
 * component renders in Server Components and Client Components alike; the
 * cost is that the weight cannot be set once through IconContext, hence this
 * wrapper binding it per icon. Size comes from a className (size-icon,
 * size-icon-sm) so it is read from tokens.css like everything else.
 */
function duotone(Base: Icon) {
  const Duotone = (props: IconProps) => <Base weight="duotone" aria-hidden {...props} />;
  Duotone.displayName = Base.displayName;
  return Duotone;
}

export const ArrowDownIcon = duotone(ArrowDown);
export const ArrowLeftIcon = duotone(ArrowLeft);
export const ArrowUpIcon = duotone(ArrowUp);
export const BuildingsIcon = duotone(Buildings);
export const CalendarIcon = duotone(CalendarDots);
export const CameraIcon = duotone(Camera);
export const CaretDownIcon = duotone(CaretDown);
export const CaretLeftIcon = duotone(CaretLeft);
export const CaretRightIcon = duotone(CaretRight);
export const CheckIcon = duotone(Check);
export const ClipboardIcon = duotone(ClipboardText);
export const CopyIcon = duotone(Copy);
export const EyeIcon = duotone(Eye);
export const EyeSlashIcon = duotone(EyeSlash);
export const HouseIcon = duotone(House);
export const InfoIcon = duotone(Info);
export const ReportIcon = duotone(FilePdf);
export const KanbanIcon = duotone(Kanban);
export const KeyIcon = duotone(Key);
export const ListIcon = duotone(List);
export const LockIcon = duotone(Lock);
export const MapPinIcon = duotone(MapPin);
export const MoonIcon = duotone(Moon);
export const MoreIcon = duotone(DotsThreeVertical);
export const PencilIcon = duotone(PencilSimple);
export const PlusIcon = duotone(Plus);
export const SearchIcon = duotone(MagnifyingGlass);
export const ShieldIcon = duotone(ShieldCheck);
export const SidebarIcon = duotone(SidebarSimple);
export const SignOutIcon = duotone(SignOut);
export const SunIcon = duotone(Sun);
export const SpinnerIcon = duotone(CircleNotch);
export const TranslateIcon = duotone(Translate);
export const TrashIcon = duotone(Trash);
export const UserIcon = duotone(User);
export const UsersIcon = duotone(Users);
export const WarningIcon = duotone(Warning);
export const XIcon = duotone(X);

/* Status vocabulary — must match the staff app's chips. Phosphor has no
   "timer-off"; ClockCountdown is its nearest reading of "the clock ran out". */
export const StatusPendingIcon = duotone(Clock);
export const StatusInProgressIcon = duotone(DotsThree);
export const StatusSubmittedIcon = duotone(PaperPlaneTilt);
export const StatusApprovedIcon = duotone(CheckCircle);
export const StatusRejectedIcon = duotone(XCircle);
export const StatusExpiredIcon = duotone(ClockCountdown);
export const StatusExtendedIcon = duotone(ArrowsClockwise);
/* Follow-up (0013): an answer missed its correct answer. The app's chip uses
   Material's flag_outlined; Phosphor's Flag is the same reading. */
export const StatusFollowUpIcon = duotone(Flag);
