import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowLeft,
  ArrowsClockwise,
  Buildings,
  Camera,
  CaretDown,
  Check,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Clock,
  ClockCountdown,
  DotsThree,
  House,
  Info,
  Key,
  MapPin,
  Moon,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  SidebarSimple,
  SignOut,
  Sun,
  Translate,
  Trash,
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

export const ArrowLeftIcon = duotone(ArrowLeft);
export const BuildingsIcon = duotone(Buildings);
export const CameraIcon = duotone(Camera);
export const CaretDownIcon = duotone(CaretDown);
export const CheckIcon = duotone(Check);
export const ClipboardIcon = duotone(ClipboardText);
export const HouseIcon = duotone(House);
export const InfoIcon = duotone(Info);
export const KeyIcon = duotone(Key);
export const MapPinIcon = duotone(MapPin);
export const MoonIcon = duotone(Moon);
export const PencilIcon = duotone(PencilSimple);
export const PlusIcon = duotone(Plus);
export const SidebarIcon = duotone(SidebarSimple);
export const SignOutIcon = duotone(SignOut);
export const SunIcon = duotone(Sun);
export const SpinnerIcon = duotone(CircleNotch);
export const TranslateIcon = duotone(Translate);
export const TrashIcon = duotone(Trash);
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
