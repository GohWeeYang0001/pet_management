import type { LocationSnapshot } from "../../types/address";
import { mapHref } from "../../utils/businessV2";

export default function LocationDisplay({ location }: { location: LocationSnapshot }) {
    const href = mapHref(location);
    return <div className="v2-location">
        {location.label && <strong>{location.label}</strong>}
        {location.address_text && <p className="compact-line">{location.address_text}</p>}
        {location.map_url && <p className="form-hint">已设置地图链接</p>}
        {!location.address_text && !location.map_url && location.latitude != null && location.longitude != null &&
            <p className="compact-line">坐标：{location.latitude}, {location.longitude}</p>}
        {href && <a className="text-button v2-map-link" href={href} target="_blank" rel="noopener noreferrer">在地图打开</a>}
    </div>;
}
