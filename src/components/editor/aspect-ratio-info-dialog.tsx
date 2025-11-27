
'use client';

import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ASPECT_RATIOS, PRO_ASPECT_RATIOS } from '@/lib/consts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditor } from '@/hooks/use-editor-store';

export default function AspectRatioInfoDialog() {
    const { isProMode } = useEditor();
    const ratiosToUse = isProMode ? PRO_ASPECT_RATIOS : ASPECT_RATIOS;

    const horizontalRatios = ratiosToUse.filter(r => r.ratio >= 1).sort((a, b) => b.ratio - a.ratio);
    const verticalRatios = ratiosToUse.filter(r => r.ratio < 1).sort((a, b) => b.ratio - a.ratio);

    const parseDimensions = (ratioString: string) => {
        const parts = ratioString.split(' / ');
        const width = parseInt(parts[0], 10);
        const height = parseInt(parts[1], 10);
        return { width, height };
    };

    return (
        <DialogContent className="w-[95vw] max-w-6xl flex flex-col max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>Padrões de Proporção {isProMode && '(Modo Pro)'}</DialogTitle>
                <DialogDescription>
                    Estes são os tamanhos e proporções padrão para os quais a IA é otimizada.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-8 py-4 px-2">
                    <div>
                        <h3 className="mb-4 font-semibold text-lg text-center lg:text-left">Proporções Horizontais</h3>
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-center">Largura</TableHead>
                                        <TableHead className="text-center">Altura</TableHead>
                                        <TableHead className="text-center">MP</TableHead>
                                        <TableHead className="text-center">Proporção</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {horizontalRatios.map(r => {
                                        const { width, height } = parseDimensions(r.dimensions);
                                        return (
                                            <TableRow key={r.name} className="hover:bg-muted/50">
                                                <TableCell className="text-center font-medium">{width} px</TableCell>
                                                <TableCell className="text-center font-medium">{height} px</TableCell>
                                                <TableCell className="text-center text-muted-foreground">{r.megapixels.toFixed(2)} MP</TableCell>
                                                <TableCell className="text-center">{r.ratio.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-4 font-semibold text-lg text-center lg:text-left">Proporções Verticais</h3>
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-center">Largura</TableHead>
                                        <TableHead className="text-center">Altura</TableHead>
                                        <TableHead className="text-center">MP</TableHead>
                                        <TableHead className="text-center">Proporção</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {verticalRatios.map(r => {
                                        const { width, height } = parseDimensions(r.dimensions);
                                        return (
                                            <TableRow key={r.name} className="hover:bg-muted/50">
                                                <TableCell className="text-center font-medium">{width} px</TableCell>
                                                <TableCell className="text-center font-medium">{height} px</TableCell>
                                                <TableCell className="text-center text-muted-foreground">{r.megapixels.toFixed(2)} MP</TableCell>
                                                <TableCell className="text-center">{r.ratio.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="shrink-0">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Fechar
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
}
