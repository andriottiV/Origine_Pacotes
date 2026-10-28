// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

beforeEach(() => { Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(){this.setAttribute("open","");}}); Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(){this.removeAttribute("open");}}); localStorage.clear(); Object.defineProperty(window,"matchMedia",{writable:true,value:vi.fn().mockImplementation(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}))}); });
afterEach(cleanup);
describe("dashboard interactions",()=>{
  it("exposes the real sales and attendance entry points",()=>{render(<HomePage/>);expect(screen.getByRole("button",{name:"Vender pacote"})).toBeEnabled();expect(screen.getByRole("button",{name:"Registrar atendimento"})).toBeEnabled();});
  it("opens search and finds the financial route",async()=>{const user=userEvent.setup();render(<HomePage/>);await user.click(screen.getByRole("button",{name:"Pesquisar"}));await user.type(screen.getByLabelText("Encontre uma seção"),"financeiro");expect(within(screen.getByRole("dialog")).getByRole("button",{name:"Financeiro"})).toBeInTheDocument();});
  it("changes and persists theme",()=>{render(<HomePage/>);fireEvent.change(screen.getByLabelText("Aparência"),{target:{value:"dark"}});expect(document.documentElement.dataset.theme).toBe("dark");expect(localStorage.getItem("origine-theme")).toBe("dark");});
  it("opens and closes mobile navigation",async()=>{const user=userEvent.setup();render(<HomePage/>);await user.click(screen.getByRole("button",{name:"Abrir menu"}));expect(screen.getByLabelText("Navegação principal")).toHaveClass("sidebar-open");await user.click(screen.getByRole("button",{name:"Fechar menu"}));expect(screen.getByLabelText("Navegação principal")).not.toHaveClass("sidebar-open");});
});
