import { showNotification } from "@mantine/notifications";

export function notifyError(summary?: string, error?: Error): void {
    notifyErrorCustom(summary, error?.message);
}

export function notifyErrorCustom(summary?: string, details?: string): void {
    showNotification({
        title: "🥵 " + summary,
        color: "red",
        message: details,
    });
}


export function notifyWarning(summary?: string, details?: string): void {
    showNotification({
        title: "🧐 " + summary,
        color: "yellow",
        message: details,
    });
}


export function notifySuccess(summary?: string, details?: string): void {
    showNotification({
        title: "🎉 " + summary,
        color: "blue",
        message: details,
    });
}


export function notifyPotentialBug(summary?: string): void {
    showNotification({
        title: "🪲 " + summary,
        color: "red",
        message: "This is probably a bug. Please report it.",
    });
}


enum NotificationCode {
    CREATE_SDK_NOT_READY,
    CREATE_ERROR,
    ENTER_WORMHOLE_ORBIT,
    ENTER_CURRENT_STAR,
    ENTER_NULL_GAME,
    ENTER_SDK_NOT_READY,
    MOVE_WORMHOLE_ORBIT,
    MOVE_NULL_GAME,
    MOVE_SDK_NOT_READY,
    LEAVE_NULL_GAME,
    LEAVE_SDK_NOT_READY,
}


export class Notifications {
    public static enterWormholeOrbit(): void {
        this.bug("Unable to enter game.", NotificationCode.ENTER_WORMHOLE_ORBIT);
    }


    public static enterCurrentStar(): void {
        this.bug("Unable to move.", NotificationCode.ENTER_CURRENT_STAR);
    }


    public static createSdkNotReady(): void {
        this.bug("Unable to create game.", NotificationCode.CREATE_SDK_NOT_READY);
    }


    public static createError(error: Error | unknown): void {
        this.error("Unable to create game.", NotificationCode.CREATE_ERROR, error);
    }


    public static enterNullGame(): void {
        this.bug("Unable to enter game.", NotificationCode.ENTER_NULL_GAME);
    }


    public static enterSdkNotReady(): void {
        this.bug("Unable to enter game.", NotificationCode.ENTER_SDK_NOT_READY);
    }


    public static moveNullGame(): void {
        this.bug("Unable to move ship.", NotificationCode.MOVE_NULL_GAME);
    }


    public static moveSdkNotReady(): void {
        this.bug("Unable to move ship.", NotificationCode.MOVE_SDK_NOT_READY);
    }


    public static moveWormholeOrbit(): void {
        this.bug("Unable to move ship.", NotificationCode.MOVE_WORMHOLE_ORBIT);
    }


    public static leaveNullGame(): void {
        this.bug("Unable to escape.", NotificationCode.LEAVE_NULL_GAME);
    }


    public static leaveSdkNotReady(): void {
        this.bug("Unable to escape.", NotificationCode.LEAVE_SDK_NOT_READY);
    }


    private static error(summary: string, code: NotificationCode, error: Error | unknown): void {
        notifyError(this.summaryWithCode(summary, code), error as unknown as Error);
    }


    private static bug(summary: string, code: NotificationCode): void {
        notifyPotentialBug(this.summaryWithCode(summary, code));
    }


    private static summaryWithCode(summary: string, code: NotificationCode): string {
        return `${summary} (${NotificationCode[code]})`;
    }
}
