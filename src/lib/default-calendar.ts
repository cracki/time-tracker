/** Default working calendar (spec §11) — shared by server and seed. */
import { CalendarSettings } from "./types";

// 0=شنبه … 6=جمعه — شنبه تا چهارشنبه کاری، پنجشنبه/جمعه تعطیل
export const DEFAULT_CALENDAR: CalendarSettings = {
  workingDays: [0, 1, 2, 3],
  workingStartTime: "08:00",
  workingEndTime: "17:00",
};
