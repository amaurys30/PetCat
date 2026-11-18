import { useQuery } from "@tanstack/react-query";

import { getSalud } from "@/api/salud";
import { queryKeys } from "@/lib/queryKeys";

export function useSalud() {
  return useQuery({ queryKey: queryKeys.salud(), queryFn: getSalud, retry: false });
}
